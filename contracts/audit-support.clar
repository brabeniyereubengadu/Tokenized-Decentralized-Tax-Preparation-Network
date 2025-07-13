;; Audit Support Contract
;; Provides assistance during tax examination processes

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_AUTHORIZED (err u500))
(define-constant ERR_AUDIT_NOT_FOUND (err u501))
(define-constant ERR_INVALID_STATUS (err u502))
(define-constant ERR_DOCUMENT_NOT_FOUND (err u503))
(define-constant ERR_INVALID_AUDIT (err u504))

;; Data Variables
(define-data-var next-audit-id uint u1)
(define-data-var next-communication-id uint u1)

;; Data Maps
(define-map audit-cases
  { audit-id: uint }
  {
    taxpayer: principal,
    tax-year: uint,
    audit-type: (string-ascii 30),
    status: (string-ascii 20),
    assigned-agent: (optional principal),
    start-date: uint,
    due-date: uint,
    total-amount-questioned: uint,
    resolution-amount: uint,
    is-resolved: bool,
    created-at: uint
  }
)

(define-map audit-documents
  { audit-id: uint, document-id: uint }
  {
    document-type: (string-ascii 50),
    document-hash: (buff 32),
    submitted-by: principal,
    is-requested: bool,
    is-reviewed: bool,
    submitted-at: uint
  }
)

(define-map audit-communications
  { communication-id: uint }
  {
    audit-id: uint,
    sender: principal,
    recipient: principal,
    message-type: (string-ascii 30),
    message-hash: (buff 32),
    is-read: bool,
    sent-at: uint
  }
)

(define-map audit-timeline
  { audit-id: uint, event-id: uint }
  {
    event-type: (string-ascii 50),
    description: (string-ascii 200),
    occurred-at: uint,
    recorded-by: principal
  }
)

(define-map document-requests
  { audit-id: uint, request-id: uint }
  {
    requested-documents: (list 20 (string-ascii 50)),
    due-date: uint,
    status: (string-ascii 20),
    requested-by: principal,
    requested-at: uint
  }
)

;; Public Functions

;; Create a new audit case
(define-public (create-audit-case
  (taxpayer principal)
  (tax-year uint)
  (audit-type (string-ascii 30))
  (due-date uint)
  (total-amount-questioned uint))
  (let
    (
      (audit-id (var-get next-audit-id))
    )
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (asserts! (> tax-year u2000) ERR_INVALID_AUDIT)
    (asserts! (> due-date block-height) ERR_INVALID_AUDIT)
    (asserts! (> (len audit-type) u0) ERR_INVALID_AUDIT)

    (map-set audit-cases
      { audit-id: audit-id }
      {
        taxpayer: taxpayer,
        tax-year: tax-year,
        audit-type: audit-type,
        status: "initiated",
        assigned-agent: none,
        start-date: block-height,
        due-date: due-date,
        total-amount-questioned: total-amount-questioned,
        resolution-amount: u0,
        is-resolved: false,
        created-at: block-height
      }
    )

    ;; Record initial timeline event
    (map-set audit-timeline
      { audit-id: audit-id, event-id: u1 }
      {
        event-type: "audit_initiated",
        description: "Audit case created and initiated",
        occurred-at: block-height,
        recorded-by: tx-sender
      }
    )

    (var-set next-audit-id (+ audit-id u1))
    (ok audit-id)
  )
)

;; Submit audit document
(define-public (submit-audit-document
  (audit-id uint)
  (document-id uint)
  (document-type (string-ascii 50))
  (document-hash (buff 32)))
  (let
    (
      (audit-case (unwrap! (map-get? audit-cases { audit-id: audit-id }) ERR_AUDIT_NOT_FOUND))
    )
    (asserts! (is-eq (get taxpayer audit-case) tx-sender) ERR_NOT_AUTHORIZED)
    (asserts! (not (get is-resolved audit-case)) ERR_INVALID_STATUS)
    (asserts! (> (len document-type) u0) ERR_INVALID_AUDIT)

    (map-set audit-documents
      { audit-id: audit-id, document-id: document-id }
      {
        document-type: document-type,
        document-hash: document-hash,
        submitted-by: tx-sender,
        is-requested: false,
        is-reviewed: false,
        submitted-at: block-height
      }
    )
    (ok true)
  )
)

;; Send audit communication
(define-public (send-audit-communication
  (audit-id uint)
  (recipient principal)
  (message-type (string-ascii 30))
  (message-hash (buff 32)))
  (let
    (
      (communication-id (var-get next-communication-id))
      (audit-case (unwrap! (map-get? audit-cases { audit-id: audit-id }) ERR_AUDIT_NOT_FOUND))
    )
    (asserts!
      (or
        (is-eq (get taxpayer audit-case) tx-sender)
        (is-eq tx-sender CONTRACT_OWNER)
      )
      ERR_NOT_AUTHORIZED
    )
    (asserts! (> (len message-type) u0) ERR_INVALID_AUDIT)

    (map-set audit-communications
      { communication-id: communication-id }
      {
        audit-id: audit-id,
        sender: tx-sender,
        recipient: recipient,
        message-type: message-type,
        message-hash: message-hash,
        is-read: false,
        sent-at: block-height
      }
    )

    (var-set next-communication-id (+ communication-id u1))
    (ok communication-id)
  )
)

;; Update audit status
(define-public (update-audit-status (audit-id uint) (new-status (string-ascii 20)))
  (let
    (
      (audit-case (unwrap! (map-get? audit-cases { audit-id: audit-id }) ERR_AUDIT_NOT_FOUND))
    )
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (asserts! (> (len new-status) u0) ERR_INVALID_STATUS)

    (map-set audit-cases
      { audit-id: audit-id }
      (merge audit-case { status: new-status })
    )
    (ok true)
  )
)

;; Resolve audit case
(define-public (resolve-audit-case (audit-id uint) (resolution-amount uint))
  (let
    (
      (audit-case (unwrap! (map-get? audit-cases { audit-id: audit-id }) ERR_AUDIT_NOT_FOUND))
    )
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (asserts! (not (get is-resolved audit-case)) ERR_INVALID_STATUS)

    (map-set audit-cases
      { audit-id: audit-id }
      (merge audit-case {
        status: "resolved",
        resolution-amount: resolution-amount,
        is-resolved: true
      })
    )

    ;; Record resolution timeline event
    (map-set audit-timeline
      { audit-id: audit-id, event-id: u2 }
      {
        event-type: "audit_resolved",
        description: "Audit case resolved with final determination",
        occurred-at: block-height,
        recorded-by: tx-sender
      }
    )
    (ok true)
  )
)

;; Request additional documents
(define-public (request-documents
  (audit-id uint)
  (request-id uint)
  (requested-documents (list 20 (string-ascii 50)))
  (due-date uint))
  (let
    (
      (audit-case (unwrap! (map-get? audit-cases { audit-id: audit-id }) ERR_AUDIT_NOT_FOUND))
    )
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (asserts! (not (get is-resolved audit-case)) ERR_INVALID_STATUS)
    (asserts! (> due-date block-height) ERR_INVALID_AUDIT)

    (map-set document-requests
      { audit-id: audit-id, request-id: request-id }
      {
        requested-documents: requested-documents,
        due-date: due-date,
        status: "pending",
        requested-by: tx-sender,
        requested-at: block-height
      }
    )
    (ok true)
  )
)

;; Mark communication as read
(define-public (mark-communication-read (communication-id uint))
  (let
    (
      (communication (unwrap! (map-get? audit-communications { communication-id: communication-id }) ERR_DOCUMENT_NOT_FOUND))
    )
    (asserts! (is-eq (get recipient communication) tx-sender) ERR_NOT_AUTHORIZED)

    (map-set audit-communications
      { communication-id: communication-id }
      (merge communication { is-read: true })
    )
    (ok true)
  )
)

;; Read-only Functions

;; Get audit case details
(define-read-only (get-audit-case (audit-id uint))
  (map-get? audit-cases { audit-id: audit-id })
)

;; Get audit document
(define-read-only (get-audit-document (audit-id uint) (document-id uint))
  (map-get? audit-documents { audit-id: audit-id, document-id: document-id })
)

;; Get audit communication
(define-read-only (get-audit-communication (communication-id uint))
  (map-get? audit-communications { communication-id: communication-id })
)

;; Get timeline event
(define-read-only (get-timeline-event (audit-id uint) (event-id uint))
  (map-get? audit-timeline { audit-id: audit-id, event-id: event-id })
)

;; Get document request
(define-read-only (get-document-request (audit-id uint) (request-id uint))
  (map-get? document-requests { audit-id: audit-id, request-id: request-id })
)

;; Check if audit is active
(define-read-only (is-audit-active (audit-id uint))
  (match (map-get? audit-cases { audit-id: audit-id })
    audit-case (and (not (get is-resolved audit-case)) (< block-height (get due-date audit-case)))
    false
  )
)

;; Get unread communications count
(define-read-only (get-unread-communications-count (audit-id uint) (user principal))
  ;; This would require iteration in a real implementation
  ;; For now, return a placeholder
  u0
)

;; Get total audit cases
(define-read-only (get-total-audit-cases)
  (- (var-get next-audit-id) u1)
)
