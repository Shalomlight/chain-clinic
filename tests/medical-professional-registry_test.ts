import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Status Constants
const STATUS_PENDING = 0;
const STATUS_VERIFIED = 1;
const STATUS_REVOKED = 2;

// Specialty Constants
const SPECIALTY_GENERAL = 0;
const SPECIALTY_SURGERY = 1;

Clarinet.test({
  name: "Medical Professional Registry: Register New Professional",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const professional = accounts.get('wallet_1')!;

    const block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'register-medical-professional', 
        [
          types.ascii("Dr. Jane Doe"),
          types.ascii("MD12345"),
          types.uint(SPECIALTY_GENERAL),
          types.list([
            types.ascii("Medical Degree"),
            types.ascii("Board Certification")
          ])
        ], 
        professional.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Verify professional status
    const status = chain.callReadOnlyFn(
      'medical-professional-registry', 
      'check-professional-status', 
      [types.principal(professional.address)],
      professional.address
    );

    status.result.expectUint(STATUS_PENDING);
  },
});

Clarinet.test({
  name: "Medical Professional Registry: Prevent Duplicate Registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const professional = accounts.get('wallet_1')!;

    const block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'register-medical-professional', 
        [
          types.ascii("Dr. Jane Doe"),
          types.ascii("MD12345"),
          types.uint(SPECIALTY_GENERAL),
          types.list([
            types.ascii("Medical Degree"),
            types.ascii("Board Certification")
          ])
        ], 
        professional.address
      ),
      Tx.contractCall(
        'medical-professional-registry', 
        'register-medical-professional', 
        [
          types.ascii("Dr. Jane Doe"),
          types.ascii("MD12345"),
          types.uint(SPECIALTY_GENERAL),
          types.list([
            types.ascii("Medical Degree"),
            types.ascii("Board Certification")
          ])
        ], 
        professional.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectErr().expectUint(101); // ERR_PROFESSIONAL_ALREADY_EXISTS
  },
});

Clarinet.test({
  name: "Medical Professional Registry: Verify Professional by Admin",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const professional = accounts.get('wallet_1')!;

    // First, register professional
    let block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'register-medical-professional', 
        [
          types.ascii("Dr. Jane Doe"),
          types.ascii("MD12345"),
          types.uint(SPECIALTY_GENERAL),
          types.list([
            types.ascii("Medical Degree"),
            types.ascii("Board Certification")
          ])
        ], 
        professional.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Then verify professional
    block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'verify-professional', 
        [types.principal(professional.address)],
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Verify professional status
    const status = chain.callReadOnlyFn(
      'medical-professional-registry', 
      'check-professional-status', 
      [types.principal(professional.address)],
      professional.address
    );

    status.result.expectUint(STATUS_VERIFIED);
  },
});

Clarinet.test({
  name: "Medical Professional Registry: Prevent Unverified Professional Credential Update",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const professional = accounts.get('wallet_1')!;

    // First, register professional
    let block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'register-medical-professional', 
        [
          types.ascii("Dr. Jane Doe"),
          types.ascii("MD12345"),
          types.uint(SPECIALTY_GENERAL),
          types.list([
            types.ascii("Medical Degree"),
            types.ascii("Board Certification")
          ])
        ], 
        professional.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Try to update credentials (should fail)
    block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'update-credentials', 
        [types.list([
          types.ascii("Updated Degree"),
          types.ascii("New Certification")
        ])],
        professional.address
      )
    ]);

    block.receipts[0].result.expectErr().expectUint(105); // ERR_PROFESSIONAL_NOT_VERIFIED
  },
});

Clarinet.test({
  name: "Medical Professional Registry: Update Credentials After Verification",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const professional = accounts.get('wallet_1')!;

    // First, register professional
    let block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'register-medical-professional', 
        [
          types.ascii("Dr. Jane Doe"),
          types.ascii("MD12345"),
          types.uint(SPECIALTY_GENERAL),
          types.list([
            types.ascii("Medical Degree"),
            types.ascii("Board Certification")
          ])
        ], 
        professional.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Verify professional
    block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'verify-professional', 
        [types.principal(professional.address)],
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Update credentials
    block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'update-credentials', 
        [types.list([
          types.ascii("Updated Degree"),
          types.ascii("New Certification")
        ])],
        professional.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "Medical Professional Registry: Revoke Professional License",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const professional = accounts.get('wallet_1')!;

    // First, register professional
    let block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'register-medical-professional', 
        [
          types.ascii("Dr. Jane Doe"),
          types.ascii("MD12345"),
          types.uint(SPECIALTY_GENERAL),
          types.list([
            types.ascii("Medical Degree"),
            types.ascii("Board Certification")
          ])
        ], 
        professional.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Verify professional
    block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'verify-professional', 
        [types.principal(professional.address)],
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Revoke professional license
    block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'revoke-professional-license', 
        [types.principal(professional.address)],
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Verify professional status
    const status = chain.callReadOnlyFn(
      'medical-professional-registry', 
      'check-professional-status', 
      [types.principal(professional.address)],
      professional.address
    );

    status.result.expectUint(STATUS_REVOKED);
  },
});

Clarinet.test({
  name: "Medical Professional Registry: Unauthorized Verification Attempt",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get('wallet_1')!;
    const professional = accounts.get('wallet_2')!;

    // First, register professional
    let block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'register-medical-professional', 
        [
          types.ascii("Dr. Jane Doe"),
          types.ascii("MD12345"),
          types.uint(SPECIALTY_GENERAL),
          types.list([
            types.ascii("Medical Degree"),
            types.ascii("Board Certification")
          ])
        ], 
        professional.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Try to verify by unauthorized user
    block = chain.mineBlock([
      Tx.contractCall(
        'medical-professional-registry', 
        'verify-professional', 
        [types.principal(professional.address)],
        user.address
      )
    ]);

    block.receipts[0].result.expectErr().expectUint(100); // ERR_UNAUTHORIZED
  },
});