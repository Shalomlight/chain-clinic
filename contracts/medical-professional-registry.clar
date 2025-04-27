;; Medical Professional Registry Contract
;; Part of the Chain Clinic decentralized medical records platform
;; Manages registration, verification, and credentials of medical professionals

;; ERROR CODES
(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_PROFESSIONAL_ALREADY_EXISTS (err u101))
(define-constant ERR_PROFESSIONAL_NOT_FOUND (err u102))
(define-constant ERR_INVALID_CREDENTIALS (err u103))
(define-constant ERR_PROFESSIONAL_ALREADY_VERIFIED (err u104))
(define-constant ERR_PROFESSIONAL_NOT_VERIFIED (err u105))
(define-constant ERR_INVALID_STATUS_CHANGE (err u106))

;; CONTRACT OWNER (ADMIN)
(define-data-var contract-owner principal tx-sender)

;; PROFESSIONAL STATUS ENUM
(define-constant STATUS_PENDING u0)
(define-constant STATUS_VERIFIED u1)
(define-constant STATUS_REVOKED u2)

;; MEDICAL SPECIALTY ENUM (EXTENSIBLE)
(define-constant SPECIALTY_GENERAL u0)
(define-constant SPECIALTY_SURGERY u1)
(define-constant SPECIALTY_PEDIATRICS u2)
(define-constant SPECIALTY_CARDIOLOGY u3)

;; PROFESSIONAL RECORD MAP
(define-map professionals 
  principal 
  {
    name: (string-ascii 100),      ;; Professional's full name
    license-number: (string-ascii 50),  ;; Unique license identifier
    specialty: uint,               ;; Medical specialty
    credentials: (list 5 (string-ascii 50)),  ;; List of credentials
    status: uint,                  ;; Verification status
    verified-by: (optional principal)  ;; Admin who verified
  }
)

;; ADMIN-ONLY MODIFIER
(define-private (is-contract-owner (caller principal))
  (is-eq caller (var-get contract-owner))
)

;; Transfer contract ownership (admin-only)
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-contract-owner tx-sender) ERR_UNAUTHORIZED)
    (var-set contract-owner new-owner)
    (ok true)
  )
)

;; Register a new medical professional
(define-public (register-medical-professional 
  (name (string-ascii 100)) 
  (license-number (string-ascii 50))
  (specialty uint)
  (credentials (list 5 (string-ascii 50)))
)
  (begin
    ;; Prevent duplicate registrations
    (asserts! 
      (is-none (map-get? professionals tx-sender)) 
      ERR_PROFESSIONAL_ALREADY_EXISTS
    )
    
    ;; Basic credential validation
    (asserts! (> (len license-number) u0) ERR_INVALID_CREDENTIALS)
    
    ;; Register professional with pending status
    (map-set professionals tx-sender {
      name: name,
      license-number: license-number,
      specialty: specialty,
      credentials: credentials,
      status: STATUS_PENDING,
      verified-by: none
    })
    
    (ok true)
  )
)

;; Verify a professional (admin-only)
(define-public (verify-professional (professional principal))
  (let ((prof-record (unwrap! (map-get? professionals professional) ERR_PROFESSIONAL_NOT_FOUND)))
    (begin
      ;; Only contract owner can verify
      (asserts! (is-contract-owner tx-sender) ERR_UNAUTHORIZED)
      
      ;; Prevent re-verification
      (asserts! (not (is-eq (get status prof-record) STATUS_VERIFIED)) ERR_PROFESSIONAL_ALREADY_VERIFIED)
      
      ;; Update status and verification details
      (map-set professionals professional 
        (merge prof-record {
          status: STATUS_VERIFIED,
          verified-by: (some tx-sender)
        })
      )
      
      (ok true)
    )
  )
)

;; Update professional credentials (verified professionals only)
(define-public (update-credentials 
  (credentials (list 5 (string-ascii 50)))
)
  (let ((prof-record (unwrap! (map-get? professionals tx-sender) ERR_PROFESSIONAL_NOT_FOUND)))
    (begin
      ;; Only verified professionals can update
      (asserts! (is-eq (get status prof-record) STATUS_VERIFIED) ERR_PROFESSIONAL_NOT_VERIFIED)
      
      ;; Update credentials while preserving other details
      (map-set professionals tx-sender 
        (merge prof-record {
          credentials: credentials
        })
      )
      
      (ok true)
    )
  )
)

;; Check professional status (read-only)
(define-read-only (check-professional-status (professional principal))
  (let ((prof-record (map-get? professionals professional)))
    (if (is-some prof-record)
        (get status (unwrap-panic prof-record))
        u404  ;; Not found
    )
  )
)

;; Revoke professional license (admin-only)
(define-public (revoke-professional-license (professional principal))
  (let ((prof-record (unwrap! (map-get? professionals professional) ERR_PROFESSIONAL_NOT_FOUND)))
    (begin
      ;; Only contract owner can revoke
      (asserts! (is-contract-owner tx-sender) ERR_UNAUTHORIZED)
      
      ;; Update status to revoked
      (map-set professionals professional 
        (merge prof-record {
          status: STATUS_REVOKED
        })
      )
      
      (ok true)
    )
  )
)

;; Initialize contract
(var-set contract-owner tx-sender)