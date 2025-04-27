import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Consent Permission Levels
const CONSENT_NONE = 0;
const CONSENT_VIEW = 1;
const CONSENT_EDIT = 2;
const CONSENT_SHARE = 4;

Clarinet.test({
  name: "Consent Management: Create Consent Token",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const patient = accounts.get('wallet_1')!;
    const grantee = accounts.get('wallet_2')!;

    const block = chain.mineBlock([
      Tx.contractCall(
        'consent-management', 
        'create-consent-token', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(CONSENT_VIEW),
          types.uint(100)  // Duration in blocks
        ], 
        patient.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Check consent status
    const status = chain.callReadOnlyFn(
      'consent-management', 
      'check-consent-status', 
      [
        types.principal(patient.address),
        types.principal(grantee.address)
      ],
      grantee.address
    );

    status.result.expectSome().expectUint(CONSENT_VIEW);
  },
});

Clarinet.test({
  name: "Consent Management: Prevent Unauthorized Consent Token Creation",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const patient = accounts.get('wallet_1')!;
    const grantee = accounts.get('wallet_2')!;
    const unauthorized = accounts.get('wallet_3')!;

    const block = chain.mineBlock([
      Tx.contractCall(
        'consent-management', 
        'create-consent-token', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(CONSENT_VIEW),
          types.uint(100)  // Duration in blocks
        ], 
        unauthorized.address
      )
    ]);

    block.receipts[0].result.expectErr().expectUint(1); // ERR_UNAUTHORIZED
  },
});

Clarinet.test({
  name: "Consent Management: Update Consent Token",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const patient = accounts.get('wallet_1')!;
    const grantee = accounts.get('wallet_2')!;

    // First, create consent token
    let block = chain.mineBlock([
      Tx.contractCall(
        'consent-management', 
        'create-consent-token', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(CONSENT_VIEW),
          types.uint(100)  // Duration in blocks
        ], 
        patient.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Update consent token
    block = chain.mineBlock([
      Tx.contractCall(
        'consent-management', 
        'update-consent', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(CONSENT_EDIT),
          types.uint(200)  // New duration
        ], 
        patient.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Check updated consent status
    const status = chain.callReadOnlyFn(
      'consent-management', 
      'check-consent-status', 
      [
        types.principal(patient.address),
        types.principal(grantee.address)
      ],
      grantee.address
    );

    status.result.expectSome().expectUint(CONSENT_EDIT);
  },
});

Clarinet.test({
  name: "Consent Management: Revoke Consent",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const patient = accounts.get('wallet_1')!;
    const grantee = accounts.get('wallet_2')!;

    // First, create consent token
    let block = chain.mineBlock([
      Tx.contractCall(
        'consent-management', 
        'create-consent-token', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(CONSENT_VIEW),
          types.uint(100)  // Duration in blocks
        ], 
        patient.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Revoke consent
    block = chain.mineBlock([
      Tx.contractCall(
        'consent-management', 
        'revoke-consent', 
        [
          types.principal(patient.address),
          types.principal(grantee.address)
        ], 
        patient.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Check revoked consent status
    const status = chain.callReadOnlyFn(
      'consent-management', 
      'check-consent-status', 
      [
        types.principal(patient.address),
        types.principal(grantee.address)
      ],
      grantee.address
    );

    status.result.expectNone();
  },
});

Clarinet.test({
  name: "Consent Management: Prevent Unauthorized Consent Updates",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const patient = accounts.get('wallet_1')!;
    const grantee = accounts.get('wallet_2')!;
    const unauthorized = accounts.get('wallet_3')!;

    // First, create consent token
    let block = chain.mineBlock([
      Tx.contractCall(
        'consent-management', 
        'create-consent-token', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(CONSENT_VIEW),
          types.uint(100)  // Duration in blocks
        ], 
        patient.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Try to update consent from unauthorized user
    block = chain.mineBlock([
      Tx.contractCall(
        'consent-management', 
        'update-consent', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(CONSENT_EDIT),
          types.uint(200)  // New duration
        ], 
        unauthorized.address
      )
    ]);

    block.receipts[0].result.expectErr().expectUint(1); // ERR_UNAUTHORIZED
  },
});

Clarinet.test({
  name: "Consent Management: Consent Token Expiry",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const patient = accounts.get('wallet_1')!;
    const grantee = accounts.get('wallet_2')!;

    // Create consent token with short duration
    let block = chain.mineBlock([
      Tx.contractCall(
        'consent-management', 
        'create-consent-token', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(CONSENT_VIEW),
          types.uint(5)  // Very short duration
        ], 
        patient.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Mine additional blocks to trigger expiry
    chain.mineEmptyBlock(10);

    // Check expired consent status
    const status = chain.callReadOnlyFn(
      'consent-management', 
      'check-consent-status', 
      [
        types.principal(patient.address),
        types.principal(grantee.address)
      ],
      grantee.address
    );

    status.result.expectNone();
  },
});