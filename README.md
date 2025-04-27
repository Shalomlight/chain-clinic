# Chain Clinic

A decentralized medical records platform built on the Stacks blockchain, providing secure, privacy-preserving medical record management with granular access controls.

## Project Overview

Chain Clinic is a decentralized platform that allows patients to securely manage their medical records on the Stacks blockchain. The platform provides the following key features:

- Secure and private storage of medical records, with patient-controlled access permissions
- Granular access controls that allow patients to grant and revoke permissions for medical professionals to view and update their records
- A registry of verified medical professionals who can access and update patient records
- Consent management capabilities that enable patients to give and revoke consent for their data to be accessed

The project is composed of several Clarity smart contracts that work together to provide this functionality.

## Contract Architecture

The Chain Clinic platform is built using the following Clarity smart contracts:

1. **Consent Management Contract**:
   - Manages patient consent tokens that grant access permissions to medical professionals
   - Allows patients to create, update, and revoke consent tokens
   - Enforces permissions and access control checks

2. **Medical Professional Registry Contract**:
   - Maintains a registry of verified medical professionals
   - Handles registration, credential updates, and license revocation
   - Provides functions to retrieve verified professional information

3. **Access Control Contract**:
   - Manages access tokens that grant medical professionals permission to view and update patient records
   - Logs access events for auditing and compliance
   - Enforces access control policies based on the consent management and medical professional registry contracts

4. **Patient Records Contract**:
   - Stores patient medical records
   - Provides functions to create, update, and retrieve records
   - Enforces access control based on the consent management and access control contracts

The contracts use Clarity maps and variables to store their state, with appropriate security checks and access control mechanisms implemented throughout.

## Installation & Setup

To set up the Chain Clinic platform, you will need the following:

- Clarinet: A Clarity smart contract development and testing tool
- Stacks blockchain development environment (e.g., Stacks Node, Stacks Explorer)

Installation steps:

1. Install Clarinet by following the instructions in the [Clarinet documentation](https://github.com/clarinets/clarinet).
2. Clone the Chain Clinic repository and navigate to the project directory.
3. Run `clarinet check` to verify the project setup.
4. (Optional) Configure any necessary environment variables or settings for your Stacks blockchain development environment.

## Usage Guide

To interact with the Chain Clinic contracts, you can use Clarinet or a Stacks blockchain client (e.g., Stacks CLI, Stacks Explorer). Here are some example use cases:

**Patient Record Management**:
1. Create a new patient record:
   ```
   (contract-call? 'patient-records-contract create-record ...)
   ```
2. Update an existing patient record:
   ```
   (contract-call? 'patient-records-contract update-record ...)
   ```
3. Retrieve a patient's medical records:
   ```
   (contract-call? 'patient-records-contract get-records ...)
   ```

**Consent Management**:
1. Create a new consent token:
   ```
   (contract-call? 'consent-management-contract create-consent-token ...)
   ```
2. Revoke a consent token:
   ```
   (contract-call? 'consent-management-contract revoke-consent-token ...)
   ```
3. Check the status of a consent token:
   ```
   (contract-call? 'consent-management-contract get-consent-token ...)
   ```

**Medical Professional Management**:
1. Register a new medical professional:
   ```
   (contract-call? 'medical-professional-registry-contract register-professional ...)
   ```
2. Update a medical professional's credentials:
   ```
   (contract-call? 'medical-professional-registry-contract update-credentials ...)
   ```
3. Revoke a medical professional's license:
   ```
   (contract-call? 'medical-professional-registry-contract revoke-license ...)
   ```

Refer to the contract-specific documentation and test cases for more detailed usage examples and expected behaviors.

## Testing

The Chain Clinic project includes a comprehensive test suite to ensure the correct functionality of the contracts. The tests cover the following scenarios:

**Consent Management Contract**:
- Creating, updating, and revoking consent tokens
- Handling unauthorized access attempts
- Verifying consent token expiry

**Medical Professional Registry Contract**:
- Registering new medical professionals
- Updating professional credentials
- Revoking medical licenses

**Access Control Contract**:
- Registering medical professionals
- Granting and revoking access tokens
- Logging access events

**Patient Records Contract**:
- Creating, updating, and retrieving patient records
- Enforcing access control based on consent and professional status

To run the tests, use the following Clarinet command:

```
clarinet test
```

## Security Considerations

The Chain Clinic platform has several security features to protect patient data and ensure the integrity of the system:

**Access Control**:
- The contracts use a combination of consent tokens and medical professional registry to grant and revoke access permissions
- Access events are logged for auditing and compliance purposes

**Data Validation**:
- All input parameters are thoroughly validated to prevent invalid or malicious data from being stored

**Permission Structures**:
- Only authorized medical professionals can access and update patient records
- Patients have full control over who can access their medical data

**Token Operations**:
- Consent tokens and access tokens are used to manage permissions, with appropriate checks and validations

**Clarity-Specific Security**:
- The contracts make use of Clarity's built-in security features, such as `asserts` to enforce conditions and prevent unauthorized actions

While the contracts have been carefully designed and tested, it is always important to review the code and conduct formal security audits before deploying to a production environment.
