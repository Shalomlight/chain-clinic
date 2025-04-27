import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Helper constants
const ACCESS_READ = 1;
const ACCESS_WRITE = 2;
const ACCESS_ADMIN = 4;

Clarinet.test({
  name: "Access Control: Register Medical Professional - Success",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const professional = accounts.get('wallet_1')!;

    const block = chain.mineBlock([
      Tx.contractCall(
        'access-control', 
        'register-medical-professional', 
        [
          types.principal(professional.address),
          types.uint(ACCESS_READ)
        ], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "Access Control: Prevent Duplicate Professional Registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const professional = accounts.get('wallet_1')!;

    const block = chain.mineBlock([
      Tx.contractCall(
        'access-control', 
        'register-medical-professional', 
        [
          types.principal(professional.address),
          types.uint(ACCESS_READ)
        ], 
        deployer.address
      ),
      Tx.contractCall(
        'access-control', 
        'register-medical-professional', 
        [
          types.principal(professional.address),
          types.uint(ACCESS_READ)
        ], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectErr().expectUint(408); // ERR_ALREADY_REGISTERED
  },
});

Clarinet.test({
  name: "Access Control: Unauthorized Professional Registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user = accounts.get('wallet_1')!;
    const professional = accounts.get('wallet_2')!;

    const block = chain.mineBlock([
      Tx.contractCall(
        'access-control', 
        'register-medical-professional', 
        [
          types.principal(professional.address),
          types.uint(ACCESS_WRITE)
        ], 
        user.address
      )
    ]);

    block.receipts[0].result.expectErr().expectUint(403); // ERR_UNAUTHORIZED
  },
});

Clarinet.test({
  name: "Access Control: Create and Validate Access Token",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const patient = accounts.get('wallet_1')!;
    const grantee = accounts.get('wallet_2')!;

    // Create access token
    let block = chain.mineBlock([
      Tx.contractCall(
        'access-control', 
        'create-access-token', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(ACCESS_READ),
          types.uint(100)  // Token duration
        ], 
        patient.address
      )
    ]);

    // Extract token ID from the result
    const tokenId = block.receipts[0].result.expectOk();

    // Validate the token
    const result = chain.callReadOnlyFn(
      'access-control', 
      'validate-access-token', 
      [
        types.buff(tokenId.toString('hex')),
        types.principal(patient.address)
      ], 
      grantee.address
    );

    // Verify token details
    result.result.expectSome().expectUint(ACCESS_READ);
  },
});

Clarinet.test({
  name: "Access Control: Revoke Access Token",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const patient = accounts.get('wallet_1')!;
    const grantee = accounts.get('wallet_2')!;

    // Create access token
    let block = chain.mineBlock([
      Tx.contractCall(
        'access-control', 
        'create-access-token', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(ACCESS_READ),
          types.uint(100)  // Token duration
        ], 
        patient.address
      )
    ]);

    // Extract token ID from the result
    const tokenId = block.receipts[0].result.expectOk();

    // Revoke token by patient
    block = chain.mineBlock([
      Tx.contractCall(
        'access-control', 
        'revoke-access-token', 
        [
          types.buff(tokenId.toString('hex')),
          types.principal(patient.address)
        ], 
        patient.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Try to validate revoked token
    const result = chain.callReadOnlyFn(
      'access-control', 
      'validate-access-token', 
      [
        types.buff(tokenId.toString('hex')),
        types.principal(patient.address)
      ], 
      grantee.address
    );

    result.result.expectNone();
  },
});

Clarinet.test({
  name: "Access Control: Log Access Event",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const patient = accounts.get('wallet_1')!;
    const grantee = accounts.get('wallet_2')!;

    // Create access token
    let block = chain.mineBlock([
      Tx.contractCall(
        'access-control', 
        'create-access-token', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(ACCESS_WRITE),
          types.uint(100)  // Token duration
        ], 
        patient.address
      )
    ]);

    // Extract token ID from the result
    const tokenId = block.receipts[0].result.expectOk();

    // Log access event
    block = chain.mineBlock([
      Tx.contractCall(
        'access-control', 
        'log-access-event', 
        [
          types.buff(tokenId.toString('hex')),
          types.principal(patient.address),
          types.uint(ACCESS_READ)
        ], 
        grantee.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "Access Control: Prevent Unauthorized Access Event Logging",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const patient = accounts.get('wallet_1')!;
    const grantee = accounts.get('wallet_2')!;
    const unauthorized = accounts.get('wallet_3')!;

    // Create access token
    let block = chain.mineBlock([
      Tx.contractCall(
        'access-control', 
        'create-access-token', 
        [
          types.principal(patient.address),
          types.principal(grantee.address),
          types.uint(ACCESS_READ),
          types.uint(100)  // Token duration
        ], 
        patient.address
      )
    ]);

    // Extract token ID from the result
    const tokenId = block.receipts[0].result.expectOk();

    // Try to log access event from unauthorized principal
    block = chain.mineBlock([
      Tx.contractCall(
        'access-control', 
        'log-access-event', 
        [
          types.buff(tokenId.toString('hex')),
          types.principal(patient.address),
          types.uint(ACCESS_READ)
        ], 
        unauthorized.address
      )
    ]);

    block.receipts[0].result.expectErr().expectUint(403); // ERR_UNAUTHORIZED
  },
});