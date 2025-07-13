;; Deduction Optimization Contract
;; Identifies all eligible tax savings opportunities

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_AUTHORIZED (err u300))
(define-constant ERR_INVALID_AMOUNT (err u301))
(define-constant ERR_RULE_NOT_FOUND (err u302))
(define-constant ERR_INVALID_RULE (err u303))
(define-constant ERR_CALCULATION_ERROR (err u304))

;; Data Variables
(define-data-var next-rule-id uint u1)
(define-data-var next-optimization-id uint u1)

;; Data Maps
(define-map deduction-rules
  { rule-id: uint }
  {
    rule-name: (string-ascii 100),
    category: (string-ascii 50),
    max-deduction: uint,
    income-threshold: uint,
    filing-status-required: (string-ascii 20),
    is-active: bool,
    created-at: uint
  }
)

(define-map taxpayer-profile
  { taxpayer: principal }
  {
    filing-status: (string-ascii 20),
    adjusted-gross-income: uint,
    tax-year: uint,
    dependents: uint,
    is-itemizing: bool,
    updated-at: uint
  }
)

(define-map deduction-claims
  { taxpayer: principal, rule-id: uint }
  {
    claimed-amount: uint,
    supporting-documents: (list 10 uint),
    is-verified: bool,
    claimed-at: uint
  }
)

(define-map optimization-results
  { optimization-id: uint }
  {
    taxpayer: principal,
    total-potential-savings: uint,
    recommended-deductions: (list 20 uint),
    estimated-refund-increase: uint,
    confidence-score: uint,
    generated-at: uint
  }
)

;; Public Functions

;; Add a new deduction rule
(define-public (add-deduction-rule
  (rule-name (string-ascii 100))
  (category (string-ascii 50))
  (max-deduction uint)
  (income-threshold uint)
  (filing-status-required (string-ascii 20)))
  (let
    (
      (rule-id (var-get next-rule-id))
    )
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (asserts! (> (len rule-name) u0) ERR_INVALID_RULE)
    (asserts! (> (len category) u0) ERR_INVALID_RULE)

    (map-set deduction-rules
      { rule-id: rule-id }
      {
        rule-name: rule-name,
        category: category,
        max-deduction: max-deduction,
        income-threshold: income-threshold,
        filing-status-required: filing-status-required,
        is-active: true,
        created-at: block-height
      }
    )

    (var-set next-rule-id (+ rule-id u1))
    (ok rule-id)
  )
)

;; Update taxpayer profile
(define-public (update-taxpayer-profile
  (filing-status (string-ascii 20))
  (adjusted-gross-income uint)
  (tax-year uint)
  (dependents uint)
  (is-itemizing bool))
  (begin
    (asserts! (> tax-year u2000) ERR_INVALID_AMOUNT)
    (asserts! (> (len filing-status) u0) ERR_INVALID_RULE)

    (map-set taxpayer-profile
      { taxpayer: tx-sender }
      {
        filing-status: filing-status,
        adjusted-gross-income: adjusted-gross-income,
        tax-year: tax-year,
        dependents: dependents,
        is-itemizing: is-itemizing,
        updated-at: block-height
      }
    )
    (ok true)
  )
)

;; Claim a deduction
(define-public (claim-deduction
  (rule-id uint)
  (claimed-amount uint)
  (supporting-documents (list 10 uint)))
  (let
    (
      (rule (unwrap! (map-get? deduction-rules { rule-id: rule-id }) ERR_RULE_NOT_FOUND))
      (profile (unwrap! (map-get? taxpayer-profile { taxpayer: tx-sender }) ERR_NOT_AUTHORIZED))
    )
    (asserts! (get is-active rule) ERR_RULE_NOT_FOUND)
    (asserts! (> claimed-amount u0) ERR_INVALID_AMOUNT)
    (asserts! (<= claimed-amount (get max-deduction rule)) ERR_INVALID_AMOUNT)

    ;; Check income threshold eligibility
    (asserts!
      (or
        (is-eq (get income-threshold rule) u0)
        (<= (get adjusted-gross-income profile) (get income-threshold rule))
      )
      ERR_NOT_AUTHORIZED
    )

    (map-set deduction-claims
      { taxpayer: tx-sender, rule-id: rule-id }
      {
        claimed-amount: claimed-amount,
        supporting-documents: supporting-documents,
        is-verified: false,
        claimed-at: block-height
      }
    )
    (ok true)
  )
)

;; Generate optimization recommendations
(define-public (generate-optimization)
  (let
    (
      (optimization-id (var-get next-optimization-id))
      (profile (unwrap! (map-get? taxpayer-profile { taxpayer: tx-sender }) ERR_NOT_AUTHORIZED))
      (potential-savings (calculate-potential-savings tx-sender))
    )
    (map-set optimization-results
      { optimization-id: optimization-id }
      {
        taxpayer: tx-sender,
        total-potential-savings: potential-savings,
        recommended-deductions: (list),
        estimated-refund-increase: (/ (* potential-savings u25) u100),
        confidence-score: u85,
        generated-at: block-height
      }
    )

    (var-set next-optimization-id (+ optimization-id u1))
    (ok optimization-id)
  )
)

;; Verify a deduction claim
(define-public (verify-deduction-claim (taxpayer principal) (rule-id uint))
  (let
    (
      (claim (unwrap! (map-get? deduction-claims { taxpayer: taxpayer, rule-id: rule-id }) ERR_RULE_NOT_FOUND))
    )
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)

    (map-set deduction-claims
      { taxpayer: taxpayer, rule-id: rule-id }
      (merge claim { is-verified: true })
    )
    (ok true)
  )
)

;; Private Functions

;; Calculate potential savings for a taxpayer
(define-private (calculate-potential-savings (taxpayer principal))
  (let
    (
      (profile (unwrap-panic (map-get? taxpayer-profile { taxpayer: taxpayer })))
      (base-savings (* (get adjusted-gross-income profile) u10))
    )
    (/ base-savings u100)
  )
)

;; Read-only Functions

;; Get deduction rule details
(define-read-only (get-deduction-rule (rule-id uint))
  (map-get? deduction-rules { rule-id: rule-id })
)

;; Get taxpayer profile
(define-read-only (get-taxpayer-profile (taxpayer principal))
  (map-get? taxpayer-profile { taxpayer: taxpayer })
)

;; Get deduction claim
(define-read-only (get-deduction-claim (taxpayer principal) (rule-id uint))
  (map-get? deduction-claims { taxpayer: taxpayer, rule-id: rule-id })
)

;; Get optimization results
(define-read-only (get-optimization-results (optimization-id uint))
  (map-get? optimization-results { optimization-id: optimization-id })
)

;; Check deduction eligibility
(define-read-only (check-deduction-eligibility (taxpayer principal) (rule-id uint))
  (let
    (
      (rule (map-get? deduction-rules { rule-id: rule-id }))
      (profile (map-get? taxpayer-profile { taxpayer: taxpayer }))
    )
    (if (and (is-some rule) (is-some profile))
      (let
        (
          (rule-data (unwrap-panic rule))
          (profile-data (unwrap-panic profile))
        )
        (and
          (get is-active rule-data)
          (or
            (is-eq (get income-threshold rule-data) u0)
            (<= (get adjusted-gross-income profile-data) (get income-threshold rule-data))
          )
        )
      )
      false
    )
  )
)

;; Get total active rules
(define-read-only (get-total-rules)
  (- (var-get next-rule-id) u1)
)
