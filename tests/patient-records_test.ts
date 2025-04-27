import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Simulated record ID and data for testing
const testRecordId = Buffer.from('test-record-123').toString('hex');
const testEncryptedRef = Buffer.from('sample-encrypted-data').toString('hex');
const testHash = Buffer.from('record-hash-123').toString('hex');

Clarinet.test({
  name: "Patient Records: Create Record - Successful Creation",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        'patient-records', 
        'create-record', 
        [
          types.buff(testRecordId), 
          types.buff(testEncryptedRef), 
          types.buff(testHash)
        ], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "Patient Records: Prevent Duplicate Record Creation",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        'patient-records', 
        'create-record', 
        [
          types.buff(testRecordId), 
          types.buff(testEncryptedRef), 
          types.buff(testHash)
        ], 
        deployer.address
      ),
      Tx.contractCall(
        'patient-records', 
        'create-record', 
        [
          types.buff(testRecordId), 
          types.buff(testEncryptedRef), 
          types.buff(testHash)
        ], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectErr().expectUint(409); // ERR_RECORD_ALREADY_EXISTS
  },
});

Clarinet.test({
  name: "Patient Records: Update Existing Record",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user = accounts.get('wallet_1')!;
    
    // First, create a record
    let block = chain.mineBlock([
      Tx.contractCall(
        'patient-records', 
        'create-record', 
        [
          types.buff(testRecordId), 
          types.buff(testEncryptedRef), 
          types.buff(testHash)
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Then update the record
    block = chain.mineBlock([
      Tx.contractCall(
        'patient-records', 
        'update-record', 
        [
          types.principal(deployer.address),
          types.buff(testRecordId),
          types.buff(Buffer.from('updated-encrypted-data').toString('hex')),
          types.buff(Buffer.from('updated-hash').toString('hex'))
        ], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "Patient Records: Unauthorized Record Update",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user = accounts.get('wallet_1')!;
    
    // First, create a record
    let block = chain.mineBlock([
      Tx.contractCall(
        'patient-records', 
        'create-record', 
        [
          types.buff(testRecordId), 
          types.buff(testEncryptedRef), 
          types.buff(testHash)
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Try to update record from unauthorized account
    block = chain.mineBlock([
      Tx.contractCall(
        'patient-records', 
        'update-record', 
        [
          types.principal(deployer.address),
          types.buff(testRecordId),
          types.buff(Buffer.from('updated-encrypted-data').toString('hex')),
          types.buff(Buffer.from('updated-hash').toString('hex'))
        ], 
        user.address
      )
    ]);

    block.receipts[0].result.expectErr().expectUint(401); // ERR_UNAUTHORIZED
  },
});

Clarinet.test({
  name: "Patient Records: Grant and Revoke Record Access",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user = accounts.get('wallet_1')!;
    
    // First, create a record
    let block = chain.mineBlock([
      Tx.contractCall(
        'patient-records', 
        'create-record', 
        [
          types.buff(testRecordId), 
          types.buff(testEncryptedRef), 
          types.buff(testHash)
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Grant access to another principal
    block = chain.mineBlock([
      Tx.contractCall(
        'patient-records', 
        'grant-record-access', 
        [
          types.buff(testRecordId),
          types.principal(user.address)
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Verify access by trying to retrieve record
    let result = chain.callReadOnlyFn(
      'patient-records', 
      'get-record-metadata', 
      [
        types.principal(deployer.address),
        types.buff(testRecordId)
      ], 
      user.address
    );
    result.result.expectOk();

    // Revoke access
    block = chain.mineBlock([
      Tx.contractCall(
        'patient-records', 
        'revoke-record-access', 
        [
          types.buff(testRecordId),
          types.principal(user.address)
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Verify access revoked
    result = chain.callReadOnlyFn(
      'patient-records', 
      'get-record-metadata', 
      [
        types.principal(deployer.address),
        types.buff(testRecordId)
      ], 
      user.address
    );
    result.result.expectErr().expectUint(401); // ERR_UNAUTHORIZED
  },
});

Clarinet.test({
  name: "Patient Records: Limit Access Principals",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // First, create a record
    let block = chain.mineBlock([
      Tx.contractCall(
        'patient-records', 
        'create-record', 
        [
          types.buff(testRecordId), 
          types.buff(testEncryptedRef), 
          types.buff(testHash)
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Attempt to add more than 10 principals
    const principals = Array.from({length: 11}, (_, i) => accounts.get(`wallet_${i+1}`)!);
    
    block = chain.mineBlock(
      principals.slice(1).map(user => 
        Tx.contractCall(
          'patient-records', 
          'grant-record-access', 
          [
            types.buff(testRecordId),
            types.principal(user.address)
          ], 
          deployer.address
        )
      )
    );

    // Last principal addition should fail
    block.receipts[9].result.expectErr().expectUint(422); // ERR_INVALID_RECORD
  },
});