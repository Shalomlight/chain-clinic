;; Chain Clinic: Decentralized Medical Records Management
;; Privacy-preserving, secure medical records platform on Stacks blockchain

;; ERROR CODES
(define-constant ERR_UNAUTHORIZED u401)
(define-constant ERR_RECORD_NOT_FOUND u404)
(define-constant ERR_RECORD_ALREADY_EXISTS u409)
(define-constant ERR_INVALID_RECORD u422)

;; DATA STRUCTURES
(define-map medical-records 
    { 
        patient: principal, 
        record-id: (buff 32) 
    }
    { 
        encrypted-ref: (buff 256),
        version: uint,
        hash: (buff 32),
        allowed-principals: (list 10 principal)
    }
)

(define-map record-versions 
    { 
        patient: principal, 
        record-id: (buff 32) 
    }
    { 
        versions: (list 50 uint) 
    }
)

;; PRIVATE HELPER FUNCTIONS
(define-private (is-record-accessible 
    (patient principal) 
    (record-id (buff 32))
)
    (match (map-get? medical-records { patient: patient, record-id: record-id })
        details 
            (or 
                (is-eq tx-sender patient)
                (some? (index-of (get allowed-principals details) tx-sender))
            )
        false
    )
)

(define-private (increment-record-version 
    (patient principal) 
    (record-id (buff 32))
)
    (let 
        ((current-versions 
            (default-to 
                { versions: (list) } 
                (map-get? record-versions { patient: patient, record-id: record-id })
            )
        ))
        (map-set record-versions 
            { 
                patient: patient, 
                record-id: record-id 
            }
            { 
                versions: 
                    (if (< (len (get versions current-versions)) u50)
                        (unwrap! 
                            (as-max-len? 
                                (append 
                                    (get versions current-versions) 
                                    (+ u1 (default-to u0 (element-at (get versions current-versions) (- (len (get versions current-versions)) u1))))
                                ) 
                                u50
                            )
                            (get versions current-versions)
                        )
                        (get versions current-versions)
                    )
            }
        )
    )
)

;; PUBLIC FUNCTIONS
;; Create a new medical record
(define-public (create-record 
  (record-id (buff 32)) 
  (encrypted-ref (buff 256)) 
  (hash (buff 32))
)
  (begin
    ;; Prevent duplicate records
    (asserts! (is-none (map-get? medical-records { patient: tx-sender, record-id: record-id })) 
      (err ERR_RECORD_ALREADY_EXISTS))
    
    ;; Store record metadata
    (map-set medical-records 
      { patient: tx-sender, record-id: record-id }
      {
        encrypted-ref: encrypted-ref,
        version: u1,
        hash: hash,
        allowed-principals: (list tx-sender)
      }
    )
    
    ;; Initialize record versions
    (map-set record-versions 
      { patient: tx-sender, record-id: record-id }
      { versions: (list u1) }
    )
    
    (ok true)
  )
)

;; Update an existing medical record
(define-public (update-record 
  (patient principal)
  (record-id (buff 32)) 
  (encrypted-ref (buff 256)) 
  (hash (buff 32))
)
  (let ((current-record (map-get? medical-records { patient: patient, record-id: record-id })))
    (asserts! (is-record-accessible patient record-id) (err ERR_UNAUTHORIZED))
    
    (match current-record
      details 
        (begin
          ;; Increment and track version
          (increment-record-version patient record-id)
          
          ;; Update record
          (map-set medical-records 
            { patient: patient, record-id: record-id }
            {
              encrypted-ref: encrypted-ref,
              version: (+ (get version details) u1),
              hash: hash,
              allowed-principals: (get allowed-principals details)
            }
          )
          
          (ok true)
        )
      (err ERR_RECORD_NOT_FOUND)
    )
  )
)

;; Retrieve medical record metadata
(define-read-only (get-record-metadata (patient principal) (record-id (buff 32)))
  (begin
    (asserts! (is-record-accessible patient record-id) (err ERR_UNAUTHORIZED))
    (map-get? medical-records { patient: patient, record-id: record-id })
  )
)

;; Get record version history
(define-read-only (get-record-versions (patient principal) (record-id (buff 32)))
  (begin
    (asserts! (is-record-accessible patient record-id) (err ERR_UNAUTHORIZED))
    (map-get? record-versions { patient: patient, record-id: record-id })
  )
)

;; Add access for another principal
(define-public (grant-record-access 
  (record-id (buff 32)) 
  (new-principal principal)
)
  (let ((current-record (map-get? medical-records { patient: tx-sender, record-id: record-id })))
    (match current-record
      details 
        (begin
          ;; Ensure no duplicate principals and list isn't full
          (asserts! (is-none (index-of (get allowed-principals details) new-principal)) (err ERR_INVALID_RECORD))
          (asserts! (< (len (get allowed-principals details)) u10) (err ERR_INVALID_RECORD))
          
          (map-set medical-records 
            { patient: tx-sender, record-id: record-id }
            {
              encrypted-ref: (get encrypted-ref details),
              version: (get version details),
              hash: (get hash details),
              allowed-principals: (unwrap! (as-max-len? (append (get allowed-principals details) new-principal) u10) (err ERR_INVALID_RECORD))
            }
          )
          
          (ok true)
        )
      (err ERR_RECORD_NOT_FOUND)
    )
  )
)

;; Revoke access for a principal
(define-public (revoke-record-access 
  (record-id (buff 32)) 
  (revoke-principal principal)
)
  (let ((current-record (map-get? medical-records { patient: tx-sender, record-id: record-id })))
    (match current-record
      details 
        (let ((updated-principals (filter (lambda (p) (not (is-eq p revoke-principal))) (get allowed-principals details))))
          (map-set medical-records 
            { patient: tx-sender, record-id: record-id }
            {
              encrypted-ref: (get encrypted-ref details),
              version: (get version details),
              hash: (get hash details),
              allowed-principals: updated-principals
            }
          )
          
          (ok true)
        )
      (err ERR_RECORD_NOT_FOUND)
    )
  )
)