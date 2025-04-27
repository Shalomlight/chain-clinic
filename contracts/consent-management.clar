;; Chain Clinic Consent Management Contract
;; A secure, patient-controlled medical record consent system
;; Implements granular, time-limited consent with comprehensive tracking

;; Error Codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_INVALID_CONSENT u2)
(define-constant ERR_CONSENT_EXPIRED u3)
(define-constant ERR_CONSENT_NOT_FOUND u4)

;; Consent Levels (Bitwise for granular permissions)
(define-constant CONSENT_NONE u0)
(define-constant CONSENT_VIEW u1)
(define-constant CONSENT_EDIT u2)
(define-constant CONSENT_SHARE u4)

;; Data Structures
;; Store consent tokens with detailed access control
(define-map consent-tokens 
  {
    patient: principal,
    grantee: principal
  }
  {
    permission-level: uint,   ;; Bitwise permission level
    granted-at: uint,         ;; Block height when consent was granted
    expires-at: uint,         ;; Block height when consent expires
    is-active: bool           ;; Current consent status
  }
)

;; Consent Event Log
(define-map consent-history 
  {
    patient: principal,
    grantee: principal,
    event-index: uint
  }
  {
    action: (string-ascii 20),  ;; 'GRANT', 'REVOKE', 'UPDATE'
    timestamp: uint,            ;; Block height of event
    permission-level: uint      ;; Permission level at time of event
  }
)

;; Track the next event index for each patient
(define-data-var patient-event-counters (map principal uint) (map.new))

;; Helper: Log consent event
(define-private (log-consent-event 
  (patient principal) 
  (grantee principal) 
  (action (string-ascii 20)) 
  (permission-level uint)
)
  (let 
    (
      (current-counter (default-to u0 (map-get? patient-event-counters patient)))
      (next-counter (+ current-counter u1))
    )
    (map-set patient-event-counters patient next-counter)
    (map-insert consent-history 
      {
        patient: patient, 
        grantee: grantee, 
        event-index: current-counter
      }
      {
        action: action,
        timestamp: block-height,
        permission-level: permission-level
      }
    )
  )
)

;; Create Consent Token
(define-public (create-consent-token 
  (patient principal)
  (grantee principal)
  (permission-level uint)
  (duration uint)
)
  (begin
    ;; Authorization: Only patient can create consent tokens
    (asserts! (is-eq tx-sender patient) (err ERR_UNAUTHORIZED))
    
    ;; Validate permission level
    (asserts! (or 
      (is-eq permission-level CONSENT_VIEW)
      (is-eq permission-level CONSENT_EDIT)
      (is-eq permission-level CONSENT_SHARE)
    ) (err ERR_INVALID_CONSENT))
    
    ;; Create consent token with specified parameters
    (map-set consent-tokens 
      {
        patient: patient, 
        grantee: grantee
      }
      {
        permission-level: permission-level,
        granted-at: block-height,
        expires-at: (+ block-height duration),
        is-active: true
      }
    )
    
    ;; Log consent grant event
    (log-consent-event patient grantee "GRANT" permission-level)
    
    (ok true)
  )
)

;; Update Consent Token
(define-public (update-consent 
  (patient principal)
  (grantee principal)
  (new-permission-level uint)
  (new-duration uint)
)
  (let 
    (
      (current-consent (unwrap! 
        (map-get? consent-tokens {patient: patient, grantee: grantee}) 
        (err ERR_CONSENT_NOT_FOUND)
      ))
    )
    ;; Authorization: Only patient can update consent
    (asserts! (is-eq tx-sender patient) (err ERR_UNAUTHORIZED))
    
    ;; Validate current consent is active
    (asserts! (get is-active current-consent) (err ERR_INVALID_CONSENT))
    
    ;; Update consent token
    (map-set consent-tokens 
      {
        patient: patient, 
        grantee: grantee
      }
      {
        permission-level: new-permission-level,
        granted-at: block-height,
        expires-at: (+ block-height new-duration),
        is-active: true
      }
    )
    
    ;; Log consent update event
    (log-consent-event patient grantee "UPDATE" new-permission-level)
    
    (ok true)
  )
)

;; Revoke Consent
(define-public (revoke-consent
  (patient principal)
  (grantee principal)
)
  (let 
    (
      (current-consent (unwrap! 
        (map-get? consent-tokens {patient: patient, grantee: grantee}) 
        (err ERR_CONSENT_NOT_FOUND)
      ))
    )
    ;; Authorization: Only patient can revoke consent
    (asserts! (is-eq tx-sender patient) (err ERR_UNAUTHORIZED))
    
    ;; Mark consent as inactive
    (map-set consent-tokens 
      {
        patient: patient, 
        grantee: grantee
      }
      (merge current-consent {is-active: false})
    )
    
    ;; Log consent revocation event
    (log-consent-event patient grantee "REVOKE" u0)
    
    (ok true)
  )
)

;; Check Consent Status
(define-read-only (check-consent-status
  (patient principal)
  (grantee principal)
)
  (match (map-get? consent-tokens {patient: patient, grantee: grantee})
    consent 
      (if 
        (and 
          (get is-active consent)
          (<= block-height (get expires-at consent))
        )
        (some (get permission-level consent))
        none
      )
    none
  )
)

;; Get Consent History
(define-read-only (get-consent-history
  (patient principal)
  (grantee principal)
)
  (some 
    (filter 
      (lambda (event-tuple) 
        (is-eq (get action event-tuple) event-tuple)
      )
      (map 
        (lambda (index) 
          (default-to 
            {action: "", timestamp: u0, permission-level: u0}
            (map-get? consent-history 
              {
                patient: patient, 
                grantee: grantee, 
                event-index: index
              }
            )
          )
        )
        (list u0 u1 u2 u3 u4)  ;; Support tracking last 5 events
      )
    )
  )
)