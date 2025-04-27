;; ChainClinic Access Control Contract
;; Provides secure, granular access management for medical records
;; Features:
;; - Role-based access control
;; - Multiple access levels (read, write, admin)
;; - Patient-controlled access grants
;; - Revocable, time-limited access tokens
;; - Comprehensive access event logging

;; Error Codes
(define-constant ERR_UNAUTHORIZED u403)
(define-constant ERR_INVALID_TOKEN u404)
(define-constant ERR_TOKEN_EXPIRED u405)
(define-constant ERR_TOKEN_ALREADY_REVOKED u406)
(define-constant ERR_INVALID_ROLE u407)
(define-constant ERR_ALREADY_REGISTERED u408)

;; Access Levels (Bit flags for flexible permissions)
(define-constant ACCESS_READ u1)      ;; 0001
(define-constant ACCESS_WRITE u2)     ;; 0010
(define-constant ACCESS_ADMIN u4)     ;; 0100

;; Maps
;; Medical Professional Registry
(define-map medical-professionals 
  principal 
  {
    role: uint,         ;; Professional's role/access level
    registered-at: uint ;; Registration timestamp
  }
)

;; Access Tokens
(define-map access-tokens 
  {
    token-id: (buff 32),   ;; Unique token identifier
    patient: principal     ;; Patient who granted the token
  }
  {
    grantee: principal,    ;; Principal granted access
    access-level: uint,    ;; Granted access permissions
    expiration: uint,      ;; Token expiration timestamp
    revoked: bool          ;; Token revocation status
  }
)

;; Access Event Log
(define-map access-events 
  {
    token-id: (buff 32),   ;; Token used for access
    timestamp: uint        ;; Timestamp of access event
  }
  {
    accessor: principal,   ;; Who accessed the records
    access-type: uint      ;; Type of access performed
  }
)

;; Owner/Admin Management
(define-data-var contract-owner principal tx-sender)

;; Private Helper Functions
(define-private (is-contract-owner (user principal))
  (is-eq user (var-get contract-owner))
)

(define-private (can-assign-role (requester principal) (target-role uint))
  (or 
    (is-contract-owner requester)
    (and 
      (is-some (map-get? medical-professionals requester))
      (is-eq target-role ACCESS_READ)  ;; Only admins can assign higher roles
    )
  )
)

;; Public Functions
;; Register a medical professional
(define-public (register-medical-professional (professional principal) (role uint))
  (begin
    ;; Validate role
    (asserts! (or 
                (is-eq role ACCESS_READ) 
                (is-eq role ACCESS_WRITE) 
                (is-eq role ACCESS_ADMIN)
              ) 
              (err ERR_INVALID_ROLE))
    
    ;; Check if already registered
    (asserts! (is-none (map-get? medical-professionals professional)) 
              (err ERR_ALREADY_REGISTERED))
    
    ;; Only contract owner or existing admins can register professionals
    (asserts! (can-assign-role tx-sender role) (err ERR_UNAUTHORIZED))
    
    ;; Register professional
    (map-set medical-professionals professional {
      role: role,
      registered-at: block-height
    })
    
    (ok true)
  )
)

;; Create an access token (patient-controlled)
(define-public (create-access-token 
                (patient principal) 
                (grantee principal) 
                (access-level uint) 
                (duration uint))
  (let 
    (
      (token-id (sha256 (concat 
        (contract-of patient) 
        (contract-of grantee)
      )))
    )
    ;; Validate access level
    (asserts! (or 
                (is-eq access-level ACCESS_READ)
                (is-eq access-level ACCESS_WRITE)
              ) 
              (err ERR_INVALID_ROLE))
    
    ;; Ensure only patient can create token
    (asserts! (is-eq tx-sender patient) (err ERR_UNAUTHORIZED))
    
    ;; Create token
    (map-set access-tokens 
      { token-id: token-id, patient: patient }
      {
        grantee: grantee,
        access-level: access-level,
        expiration: (+ block-height duration),
        revoked: false
      }
    )
    
    (ok token-id)
  )
)

;; Validate access token
(define-read-only (validate-access-token 
                   (token-id (buff 32)) 
                   (patient principal))
  (match (map-get? access-tokens { token-id: token-id, patient: patient })
    token-data
      (if (and 
            (not (get revoked token-data))
            (<= block-height (get expiration token-data))
          )
          (some (get access-level token-data))
          none
      )
    none
  )
)

;; Revoke an access token
(define-public (revoke-access-token 
                (token-id (buff 32)) 
                (patient principal))
  (begin
    ;; Ensure only patient can revoke their token
    (asserts! (is-eq tx-sender patient) (err ERR_UNAUTHORIZED))
    
    (match (map-get? access-tokens { token-id: token-id, patient: patient })
      token-data
        (begin
          (asserts! (not (get revoked token-data)) (err ERR_TOKEN_ALREADY_REVOKED))
          
          (map-set access-tokens 
            { token-id: token-id, patient: patient }
            (merge token-data { revoked: true })
          )
          
          (ok true)
        )
      (err ERR_INVALID_TOKEN)
    )
  )
)

;; Log access event
(define-public (log-access-event 
                (token-id (buff 32)) 
                (patient principal) 
                (access-type uint))
  (let 
    ((access-token (validate-access-token token-id patient)))
    (match access-token
      level
        (begin
          ;; Ensure access type matches token level
          (asserts! 
            (or 
              (is-eq access-type ACCESS_READ)
              (and (is-eq access-type ACCESS_WRITE) (>= level ACCESS_WRITE))
            )
            (err ERR_UNAUTHORIZED)
          )
          
          (map-set access-events 
            { 
              token-id: token-id, 
              timestamp: block-height 
            }
            {
              accessor: tx-sender,
              access-type: access-type
            }
          )
          
          (ok true)
        )
      (err ERR_INVALID_TOKEN)
    )
  )
)

;; Initialize contract
(define-public (initialize)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (ok true)
  )
)