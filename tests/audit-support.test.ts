import { describe, it, expect, beforeEach } from "vitest"

describe("Audit Support Contract", () => {
  let contractState = {
    auditCases: new Map(),
    auditDocuments: new Map(),
    auditCommunications: new Map(),
    auditTimeline: new Map(),
    documentRequests: new Map(),
    nextAuditId: 1,
    nextCommunicationId: 1,
  }
  
  const mockContractOwner = "ST1CONTRACT_OWNER"
  const mockTaxpayer = "ST1TAXPAYER_ADDRESS"
  const mockAgent = "ST1AUDIT_AGENT"
  const mockTaxYear = 2023
  const mockAuditType = "Correspondence"
  const mockAmountQuestioned = 5000
  
  beforeEach(() => {
    contractState = {
      auditCases: new Map(),
      auditDocuments: new Map(),
      auditCommunications: new Map(),
      auditTimeline: new Map(),
      documentRequests: new Map(),
      nextAuditId: 1,
      nextCommunicationId: 1,
    }
  })
  
  describe("create-audit-case", () => {
    it("should create audit case successfully by owner", () => {
      const dueDate = Date.now() + 86400000 // 1 day from now
      
      const result = createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      expect(result.success).toBe(true)
      expect(result.value).toBe(1)
      expect(contractState.auditCases.has(1)).toBe(true)
      expect(contractState.auditTimeline.has("1-1")).toBe(true)
      expect(contractState.nextAuditId).toBe(2)
    })
    
    it("should reject audit case creation by non-owner", () => {
      const dueDate = Date.now() + 86400000
      
      const result = createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          "ST1NOT_OWNER",
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(500) // ERR_NOT_AUTHORIZED
    })
    
    it("should reject invalid tax year", () => {
      const dueDate = Date.now() + 86400000
      
      const result = createAuditCase(
          mockTaxpayer,
          1999,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(504) // ERR_INVALID_AUDIT
    })
    
    it("should reject past due date", () => {
      const dueDate = Date.now() - 86400000 // 1 day ago
      
      const result = createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(504) // ERR_INVALID_AUDIT
    })
  })
  
  describe("submit-audit-document", () => {
    it("should submit document successfully", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const documentHash = new Uint8Array(32).fill(1)
      const result = submitAuditDocument(1, 1, "Bank Statement", documentHash, contractState, mockTaxpayer)
      
      expect(result.success).toBe(true)
      const docKey = `${1}-${1}`
      expect(contractState.auditDocuments.has(docKey)).toBe(true)
    })
    
    it("should reject document submission by non-taxpayer", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const documentHash = new Uint8Array(32).fill(1)
      const result = submitAuditDocument(1, 1, "Bank Statement", documentHash, contractState, "ST1DIFFERENT_USER")
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(500) // ERR_NOT_AUTHORIZED
    })
    
    it("should reject document submission for resolved audit", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      // Resolve the audit first
      resolveAuditCase(1, 2000, contractState, mockContractOwner)
      
      const documentHash = new Uint8Array(32).fill(1)
      const result = submitAuditDocument(1, 1, "Bank Statement", documentHash, contractState, mockTaxpayer)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(502) // ERR_INVALID_STATUS
    })
  })
  
  describe("send-audit-communication", () => {
    it("should send communication successfully by taxpayer", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const messageHash = new Uint8Array(32).fill(2)
      const result = sendAuditCommunication(1, mockAgent, "Question", messageHash, contractState, mockTaxpayer)
      
      expect(result.success).toBe(true)
      expect(result.value).toBe(1)
      expect(contractState.auditCommunications.has(1)).toBe(true)
      expect(contractState.nextCommunicationId).toBe(2)
    })
    
    it("should send communication successfully by owner", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const messageHash = new Uint8Array(32).fill(2)
      const result = sendAuditCommunication(1, mockTaxpayer, "Response", messageHash, contractState, mockContractOwner)
      
      expect(result.success).toBe(true)
      expect(result.value).toBe(1)
    })
    
    it("should reject communication by unauthorized user", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const messageHash = new Uint8Array(32).fill(2)
      const result = sendAuditCommunication(
          1,
          mockAgent,
          "Question",
          messageHash,
          contractState,
          "ST1UNAUTHORIZED_USER",
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(500) // ERR_NOT_AUTHORIZED
    })
  })
  
  describe("resolve-audit-case", () => {
    it("should resolve audit case successfully by owner", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const result = resolveAuditCase(1, 2000, contractState, mockContractOwner)
      
      expect(result.success).toBe(true)
      const auditCase = contractState.auditCases.get(1)
      expect(auditCase.status).toBe("resolved")
      expect(auditCase.isResolved).toBe(true)
      expect(auditCase.resolutionAmount).toBe(2000)
      expect(contractState.auditTimeline.has("1-2")).toBe(true)
    })
    
    it("should reject resolution by non-owner", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const result = resolveAuditCase(1, 2000, contractState, "ST1NOT_OWNER")
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(500) // ERR_NOT_AUTHORIZED
    })
    
    it("should reject resolution of already resolved audit", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      resolveAuditCase(1, 2000, contractState, mockContractOwner)
      const result = resolveAuditCase(1, 3000, contractState, mockContractOwner)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(502) // ERR_INVALID_STATUS
    })
  })
  
  describe("request-documents", () => {
    it("should request documents successfully by owner", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const requestedDocs = ["Bank Statements", "Receipts"]
      const docDueDate = Date.now() + 172800000 // 2 days from now
      
      const result = requestDocuments(1, 1, requestedDocs, docDueDate, contractState, mockContractOwner)
      
      expect(result.success).toBe(true)
      const requestKey = `${1}-${1}`
      expect(contractState.documentRequests.has(requestKey)).toBe(true)
    })
    
    it("should reject document request by non-owner", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const requestedDocs = ["Bank Statements"]
      const docDueDate = Date.now() + 172800000
      
      const result = requestDocuments(1, 1, requestedDocs, docDueDate, contractState, "ST1NOT_OWNER")
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(500) // ERR_NOT_AUTHORIZED
    })
  })
  
  describe("mark-communication-read", () => {
    it("should mark communication as read by recipient", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const messageHash = new Uint8Array(32).fill(2)
      sendAuditCommunication(1, mockTaxpayer, "Response", messageHash, contractState, mockContractOwner)
      
      const result = markCommunicationRead(1, contractState, mockTaxpayer)
      
      expect(result.success).toBe(true)
      const communication = contractState.auditCommunications.get(1)
      expect(communication.isRead).toBe(true)
    })
    
    it("should reject marking by non-recipient", () => {
      const dueDate = Date.now() + 86400000
      createAuditCase(
          mockTaxpayer,
          mockTaxYear,
          mockAuditType,
          dueDate,
          mockAmountQuestioned,
          contractState,
          mockContractOwner,
      )
      
      const messageHash = new Uint8Array(32).fill(2)
      sendAuditCommunication(1, mockTaxpayer, "Response", messageHash, contractState, mockContractOwner)
      
      const result = markCommunicationRead(1, contractState, "ST1DIFFERENT_USER")
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(500) // ERR_NOT_AUTHORIZED
    })
  })
})

// Mock contract functions
function createAuditCase(taxpayer, taxYear, auditType, dueDate, totalAmountQuestioned, state, txSender) {
  if (txSender !== "ST1CONTRACT_OWNER") return { success: false, error: 500 }
  if (taxYear <= 2000) return { success: false, error: 504 }
  if (dueDate <= Date.now()) return { success: false, error: 504 }
  if (auditType.length === 0) return { success: false, error: 504 }
  
  const auditId = state.nextAuditId
  state.auditCases.set(auditId, {
    taxpayer,
    taxYear,
    auditType,
    status: "initiated",
    assignedAgent: null,
    startDate: Date.now(),
    dueDate,
    totalAmountQuestioned,
    resolutionAmount: 0,
    isResolved: false,
    createdAt: Date.now(),
  })
  
  const timelineKey = `${auditId}-1`
  state.auditTimeline.set(timelineKey, {
    eventType: "audit_initiated",
    description: "Audit case created and initiated",
    occurredAt: Date.now(),
    recordedBy: txSender,
  })
  
  state.nextAuditId += 1
  return { success: true, value: auditId }
}

function submitAuditDocument(auditId, documentId, documentType, documentHash, state, txSender) {
  const auditCase = state.auditCases.get(auditId)
  if (!auditCase) return { success: false, error: 501 }
  if (auditCase.taxpayer !== txSender) return { success: false, error: 500 }
  if (auditCase.isResolved) return { success: false, error: 502 }
  if (documentType.length === 0) return { success: false, error: 504 }
  
  const docKey = `${auditId}-${documentId}`
  state.auditDocuments.set(docKey, {
    documentType,
    documentHash,
    submittedBy: txSender,
    isRequested: false,
    isReviewed: false,
    submittedAt: Date.now(),
  })
  
  return { success: true, value: true }
}

function sendAuditCommunication(auditId, recipient, messageType, messageHash, state, txSender) {
  const auditCase = state.auditCases.get(auditId)
  if (!auditCase) return { success: false, error: 501 }
  
  const isAuthorized = auditCase.taxpayer === txSender || txSender === "ST1CONTRACT_OWNER"
  if (!isAuthorized) return { success: false, error: 500 }
  if (messageType.length === 0) return { success: false, error: 504 }
  
  const communicationId = state.nextCommunicationId
  state.auditCommunications.set(communicationId, {
    auditId,
    sender: txSender,
    recipient,
    messageType,
    messageHash,
    isRead: false,
    sentAt: Date.now(),
  })
  
  state.nextCommunicationId += 1
  return { success: true, value: communicationId }
}

function resolveAuditCase(auditId, resolutionAmount, state, txSender) {
  if (txSender !== "ST1CONTRACT_OWNER") return { success: false, error: 500 }
  
  const auditCase = state.auditCases.get(auditId)
  if (!auditCase) return { success: false, error: 501 }
  if (auditCase.isResolved) return { success: false, error: 502 }
  
  auditCase.status = "resolved"
  auditCase.resolutionAmount = resolutionAmount
  auditCase.isResolved = true
  
  const timelineKey = `${auditId}-2`
  state.auditTimeline.set(timelineKey, {
    eventType: "audit_resolved",
    description: "Audit case resolved with final determination",
    occurredAt: Date.now(),
    recordedBy: txSender,
  })
  
  return { success: true, value: true }
}

function requestDocuments(auditId, requestId, requestedDocuments, dueDate, state, txSender) {
  if (txSender !== "ST1CONTRACT_OWNER") return { success: false, error: 500 }
  
  const auditCase = state.auditCases.get(auditId)
  if (!auditCase) return { success: false, error: 501 }
  if (auditCase.isResolved) return { success: false, error: 502 }
  if (dueDate <= Date.now()) return { success: false, error: 504 }
  
  const requestKey = `${auditId}-${requestId}`
  state.documentRequests.set(requestKey, {
    requestedDocuments,
    dueDate,
    status: "pending",
    requestedBy: txSender,
    requestedAt: Date.now(),
  })
  
  return { success: true, value: true }
}

function markCommunicationRead(communicationId, state, txSender) {
  const communication = state.auditCommunications.get(communicationId)
  if (!communication) return { success: false, error: 503 }
  if (communication.recipient !== txSender) return { success: false, error: 500 }
  
  communication.isRead = true
  return { success: true, value: true }
}
