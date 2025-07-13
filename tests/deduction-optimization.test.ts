import { describe, it, expect, beforeEach } from "vitest"

describe("Deduction Optimization Contract", () => {
  let contractState = {
    deductionRules: new Map(),
    taxpayerProfiles: new Map(),
    deductionClaims: new Map(),
    optimizationResults: new Map(),
    nextRuleId: 1,
    nextOptimizationId: 1,
  }
  
  const mockContractOwner = "ST1CONTRACT_OWNER"
  const mockTaxpayer = "ST1TAXPAYER_ADDRESS"
  const mockRuleName = "Home Office Deduction"
  const mockCategory = "Business Expenses"
  const mockMaxDeduction = 5000
  const mockIncomeThreshold = 100000
  const mockFilingStatus = "Single"
  
  beforeEach(() => {
    contractState = {
      deductionRules: new Map(),
      taxpayerProfiles: new Map(),
      deductionClaims: new Map(),
      optimizationResults: new Map(),
      nextRuleId: 1,
      nextOptimizationId: 1,
    }
  })
  
  describe("add-deduction-rule", () => {
    it("should add deduction rule successfully by owner", () => {
      const result = addDeductionRule(
          mockRuleName,
          mockCategory,
          mockMaxDeduction,
          mockIncomeThreshold,
          mockFilingStatus,
          contractState,
          mockContractOwner,
      )
      
      expect(result.success).toBe(true)
      expect(result.value).toBe(1)
      expect(contractState.deductionRules.has(1)).toBe(true)
      expect(contractState.nextRuleId).toBe(2)
    })
    
    it("should reject rule addition by non-owner", () => {
      const result = addDeductionRule(
          mockRuleName,
          mockCategory,
          mockMaxDeduction,
          mockIncomeThreshold,
          mockFilingStatus,
          contractState,
          "ST1NOT_OWNER",
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(300) // ERR_NOT_AUTHORIZED
    })
    
    it("should reject empty rule name", () => {
      const result = addDeductionRule(
          "",
          mockCategory,
          mockMaxDeduction,
          mockIncomeThreshold,
          mockFilingStatus,
          contractState,
          mockContractOwner,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(303) // ERR_INVALID_RULE
    })
  })
  
  describe("update-taxpayer-profile", () => {
    it("should update taxpayer profile successfully", () => {
      const result = updateTaxpayerProfile("Single", 75000, 2023, 0, true, contractState, mockTaxpayer)
      
      expect(result.success).toBe(true)
      expect(contractState.taxpayerProfiles.has(mockTaxpayer)).toBe(true)
      const profile = contractState.taxpayerProfiles.get(mockTaxpayer)
      expect(profile.adjustedGrossIncome).toBe(75000)
      expect(profile.taxYear).toBe(2023)
    })
    
    it("should reject invalid tax year", () => {
      const result = updateTaxpayerProfile("Single", 75000, 1999, 0, true, contractState, mockTaxpayer)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(301) // ERR_INVALID_AMOUNT
    })
    
    it("should reject empty filing status", () => {
      const result = updateTaxpayerProfile("", 75000, 2023, 0, true, contractState, mockTaxpayer)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(303) // ERR_INVALID_RULE
    })
  })
  
  describe("claim-deduction", () => {
    it("should claim deduction successfully", () => {
      // Add rule first
      addDeductionRule(
          mockRuleName,
          mockCategory,
          mockMaxDeduction,
          mockIncomeThreshold,
          mockFilingStatus,
          contractState,
          mockContractOwner,
      )
      
      // Update taxpayer profile
      updateTaxpayerProfile("Single", 75000, 2023, 0, true, contractState, mockTaxpayer)
      
      const result = claimDeduction(1, 3000, [1, 2, 3], contractState, mockTaxpayer)
      
      expect(result.success).toBe(true)
      const claimKey = `${mockTaxpayer}-${1}`
      expect(contractState.deductionClaims.has(claimKey)).toBe(true)
    })
    
    it("should reject claim exceeding max deduction", () => {
      addDeductionRule(
          mockRuleName,
          mockCategory,
          mockMaxDeduction,
          mockIncomeThreshold,
          mockFilingStatus,
          contractState,
          mockContractOwner,
      )
      
      updateTaxpayerProfile("Single", 75000, 2023, 0, true, contractState, mockTaxpayer)
      
      const result = claimDeduction(
          1,
          6000, // Exceeds max deduction of 5000
          [1, 2, 3],
          contractState,
          mockTaxpayer,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(301) // ERR_INVALID_AMOUNT
    })
    
    it("should reject claim for income above threshold", () => {
      addDeductionRule(
          mockRuleName,
          mockCategory,
          mockMaxDeduction,
          50000, // Lower income threshold
          mockFilingStatus,
          contractState,
          mockContractOwner,
      )
      
      updateTaxpayerProfile(
          "Single",
          75000, // Above threshold
          2023,
          0,
          true,
          contractState,
          mockTaxpayer,
      )
      
      const result = claimDeduction(1, 3000, [1, 2, 3], contractState, mockTaxpayer)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(300) // ERR_NOT_AUTHORIZED
    })
  })
  
  describe("generate-optimization", () => {
    it("should generate optimization successfully", () => {
      updateTaxpayerProfile("Single", 75000, 2023, 0, true, contractState, mockTaxpayer)
      
      const result = generateOptimization(contractState, mockTaxpayer)
      
      expect(result.success).toBe(true)
      expect(result.value).toBe(1)
      expect(contractState.optimizationResults.has(1)).toBe(true)
    })
    
    it("should reject optimization without profile", () => {
      const result = generateOptimization(contractState, mockTaxpayer)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(300) // ERR_NOT_AUTHORIZED
    })
  })
  
  describe("check-deduction-eligibility", () => {
    it("should return true for eligible deduction", () => {
      addDeductionRule(
          mockRuleName,
          mockCategory,
          mockMaxDeduction,
          mockIncomeThreshold,
          mockFilingStatus,
          contractState,
          mockContractOwner,
      )
      
      updateTaxpayerProfile("Single", 75000, 2023, 0, true, contractState, mockTaxpayer)
      
      const result = checkDeductionEligibility(mockTaxpayer, 1, contractState)
      expect(result).toBe(true)
    })
    
    it("should return false for ineligible deduction", () => {
      addDeductionRule(
          mockRuleName,
          mockCategory,
          mockMaxDeduction,
          50000, // Lower threshold
          mockFilingStatus,
          contractState,
          mockContractOwner,
      )
      
      updateTaxpayerProfile(
          "Single",
          75000, // Above threshold
          2023,
          0,
          true,
          contractState,
          mockTaxpayer,
      )
      
      const result = checkDeductionEligibility(mockTaxpayer, 1, contractState)
      expect(result).toBe(false)
    })
  })
})

// Mock contract functions
function addDeductionRule(ruleName, category, maxDeduction, incomeThreshold, filingStatusRequired, state, txSender) {
  if (txSender !== "ST1CONTRACT_OWNER") return { success: false, error: 300 }
  if (ruleName.length === 0) return { success: false, error: 303 }
  if (category.length === 0) return { success: false, error: 303 }
  
  const ruleId = state.nextRuleId
  state.deductionRules.set(ruleId, {
    ruleName,
    category,
    maxDeduction,
    incomeThreshold,
    filingStatusRequired,
    isActive: true,
    createdAt: Date.now(),
  })
  
  state.nextRuleId += 1
  return { success: true, value: ruleId }
}

function updateTaxpayerProfile(filingStatus, adjustedGrossIncome, taxYear, dependents, isItemizing, state, txSender) {
  if (taxYear <= 2000) return { success: false, error: 301 }
  if (filingStatus.length === 0) return { success: false, error: 303 }
  
  state.taxpayerProfiles.set(txSender, {
    filingStatus,
    adjustedGrossIncome,
    taxYear,
    dependents,
    isItemizing,
    updatedAt: Date.now(),
  })
  
  return { success: true, value: true }
}

function claimDeduction(ruleId, claimedAmount, supportingDocuments, state, txSender) {
  const rule = state.deductionRules.get(ruleId)
  if (!rule) return { success: false, error: 302 }
  
  const profile = state.taxpayerProfiles.get(txSender)
  if (!profile) return { success: false, error: 300 }
  
  if (!rule.isActive) return { success: false, error: 302 }
  if (claimedAmount <= 0) return { success: false, error: 301 }
  if (claimedAmount > rule.maxDeduction) return { success: false, error: 301 }
  
  if (rule.incomeThreshold > 0 && profile.adjustedGrossIncome > rule.incomeThreshold) {
    return { success: false, error: 300 }
  }
  
  const claimKey = `${txSender}-${ruleId}`
  state.deductionClaims.set(claimKey, {
    claimedAmount,
    supportingDocuments,
    isVerified: false,
    claimedAt: Date.now(),
  })
  
  return { success: true, value: true }
}

function generateOptimization(state, txSender) {
  const profile = state.taxpayerProfiles.get(txSender)
  if (!profile) return { success: false, error: 300 }
  
  const optimizationId = state.nextOptimizationId
  const potentialSavings = Math.floor((profile.adjustedGrossIncome * 0.1) / 100)
  
  state.optimizationResults.set(optimizationId, {
    taxpayer: txSender,
    totalPotentialSavings: potentialSavings,
    recommendedDeductions: [],
    estimatedRefundIncrease: Math.floor(potentialSavings * 0.25),
    confidenceScore: 85,
    generatedAt: Date.now(),
  })
  
  state.nextOptimizationId += 1
  return { success: true, value: optimizationId }
}

function checkDeductionEligibility(taxpayer, ruleId, state) {
  const rule = state.deductionRules.get(ruleId)
  const profile = state.taxpayerProfiles.get(taxpayer)
  
  if (!rule || !profile) return false
  
  if (!rule.isActive) return false
  if (rule.incomeThreshold > 0 && profile.adjustedGrossIncome > rule.incomeThreshold) return false
  
  return true
}
