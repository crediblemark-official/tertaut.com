Disburse to Bank Testing Scenarios
Mandatory API Testing
0 of 0
We require our merchants to test core API scenarios for compliance purposes. Complete the scenarios below using your testing credentials and we’ll automatically verify your test scenarios.
Dana Disbursement Bank Top Up
POST
/v1.0/emoney/transfer-bank.htm
0 of 7 completed
Successfully requests Transfer to Bank
Not Tested
Test Scenario
Merchant Requests Transfer to Bank and gets success response
POST /v1.0/emoney/transfer-bank.htm api call
API returns success with code 2004300
Use beneficiaryAccountNumber: 2460888509 and beneficiaryBankCode: 014
Expected Response
Not verified
Returns responseCode 2004300 with responseMessage Success
In App Partner Action
Merchant shows transaction as successful along with referenceNo & partnerReferenceNo
Transfer to Bank with Request In Progress
Not Tested
Test Scenario
Merchant Requests Bank Transfer and gets Request In Progress response
transfer To Bank with valid data and needNotify = true
amount: 50000 IDR
beneficiaryAccountNumber: 2460888509
beneficiaryBankCode: 014
Expected Response
Not verified
Returns responseCode 2024300 with responseMessage Request In Progress
In App Partner Action
Merchant shows transaction as in progress along with referenceNo and details and merchant could do retry with same payload request
Error Inconsistent Request when transfer To Bank
Not Tested
Test Scenario
Merchant Requests Bank Transfer and gets Inconsistent Request error
transfer To Bank twice, with the valid data first then hit the second time use the same request but different in the amount
Expected Response
Not verified
Returns responseCode 4044318 with responseMessage Inconsistent Request
In App Partner Action
Merchant shows error message and does not process duplicate inconsistent transfer
Error Insufficient Fund when Transfer to Bank
Not Tested
Test Scenario
Merchant Requests Transfer to Bank and gets Insufficient Fund error
POST /v1.0/emoney/transfer-bank.htm api call
API returns success with code 4034314
beneficiaryAccountNumber: 81298055129/ 2460888509 with amount: 50000000000 IDR & beneficiaryBankCode: 014
Expected Response
Not verified
Returns responseCode 4034314 with responseMessage Insufficient Fund
In App Partner Action
Merchant shows appropriate error message and does not cut user's account balance
Error Inactive Account when request Disbursement Top Up
Not Tested
Test Scenario
Merchant Requests Transfer to Bank and gets Inactive Account error
POST /v1.0/emoney/transfer-bank.htm api call
API returns success with code 4034318
Use beneficiaryAccountNumber: 81398055100
Expected Response
Not verified
Returns responseCode 4034318 with responseMessage Inactive Account Merchant
In App Partner Action
Merchant shows appropriate error message and does not cut user's account balance
Invalid Field Format error when transfer To Bank
Not Tested
Test Scenario
Merchant Requests Bank Transfer and gets Invalid Field Format error
transfer To Bank with amount.currency parameter not 'IDR' (ex: USD)
Expected Response
Not verified
Returns responseCode 4004301 with responseMessage Invalid Field Format
In App Partner Action
Merchant shows error for invalid field format and asks for proper request value
Missing mandatory field error when transfer To Bank
Not Tested
Test Scenario
Merchant Requests Bank Transfer and gets Missing Mandatory Field {........}
POST /v1.0/emoney/transfer-bank.htm api call
API returns Missing Mandatory Field {........} with code 4004302
Expected Response
Not verified
Returns responseCode 4004302 with responseMessage Missing Mandatory Field {........}
In App Partner Action
Merchant shows error for invalid field format and asks for proper parameter request
Additional API Testing
While these scenarios are not mandatory to receive production credentials, we recommend you test these scenarios to ensure service reliability.
Feel free to try the additional scenarios below. However, if you decide to use any of the APIs listed below, you will need to complete every testing scenarios relating to that API to apply for production credentials.
DANA Disbursement Bank Account Inquiry
POST
/v1.0/emoney/bank-account-inquiry.htm
Not Started
Successfully requests Disbursement Bank Account Inquiry
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up status inquiry and gets success response
POST /v1.0/emoney/bank-account-inquiry.htm api call
API returns success with code 2004200
Use beneficiaryAccountNumber 2460888509 and beneficiaryBankCode 014
Expected Response
Not verified
Returns responseCode 2004200 with responseMessage Successful
In App Partner Action
Merchant shows transaction as successful along with beneficiaryAccountName, beneficiaryBankName and referenceNo
Insufficient Fund
Not Tested
Test Scenario
Merchant Requests Disbursement Bank and gets Insufficient Fund response
POST /v1.0/emoney/bank-account-inquiry.htm api call
API returns error with code 4034214
Use beneficiaryAccountNumber: 8551003634/ 2460888509 with amount: 50000000000 IDR & beneficiaryBankCode: 014
Expected Response
Not verified
Returns responseCode 4034214 with responseMessage Insufficient Fund
In App Partner Action
-

Error Inactive Account Merchant when request Disbursement Top Up
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up status inquiry and gets Inactive Account error
POST /v1.0/emoney/bank-account-inquiry.htm api call
API returns success with code 4034218
Use beneficiaryAccountNumber: 81298055132
Expected Response
Not verified
Returns responseCode 4034218 with responseMessage Inactive Account Merchant
In App Partner Action
-

Unauthorized Invalid Signature
Not Tested
Test Scenario
Merchant Requests Disbursement Bank inquiry and gets Unauthorized Invalid Signature response
POST /v1.0/emoney/bank-account-inquiry.htm api call
API returns success with code 4014200
Use invalid Signature
Expected Response
Not verified
Returns responseCode 4014200 with responseMessage Unauthorized Invalid Signature
In App Partner Action
-

Invalid Card/Account/Customer Number/Virtual Account
Not Tested
Test Scenario
Merchant Requests Disbursement Bank and gets Invalid Card/Account/Customer Number/Virtual Account response
POST /v1.0/emoney/bank-account-inquiry.htm api call
API returns error with code 4044211
Use beneficiaryAccountNumber: 815919191
Expected Response
Not verified
Returns responseCode 4044211 with responseMessage Invalid Card/Account/Customer Number/Virtual Account
In App Partner Action
-

Invalid Field Format
Not Tested
Test Scenario
Merchant Requests Disbursement Bank inquiry and gets Invalid Field Format response
POST /v1.0/emoney/bank-account-inquiry.htm api call
API returns success with code 4004201
Use currency: USD
Expected Response
Not verified
Returns responseCode 4004201 with responseMessage Invalid Field Format
In App Partner Action
-

Missing Mandatory Field
Not Tested
Test Scenario
Merchant Requests Disbursement Bank inquiry and gets Missing Mandatory Field response
POST /v1.0/emoney/bank-account-inquiry.htm api call
API returns success with code 4004202
Remove param fundType
Expected Response
Not verified
Returns responseCode 4004202 with responseMessage Missing Mandatory Field {.........}
In App Partner Action
-

Dana Disbursement Bank Top Up
POST
/v1.0/emoney/transfer-bank.htm
Not Started
Unauthorized Invalid Signature
Not Tested
Test Scenario
Merchant Requests Transfer to Bank and gets Unauthorized Invalid Signature response
POST /v1.0/emoney/transfer-bank.htm api call
API returns success with code 4014300
Expected Response
Not verified
Returns responseCode 4014300 with responseMessage Unauthorized Invalid Signature
In App Partner Action
-

General Error when transfer To Bank
Not Tested
Test Scenario
Merchant Requests Bank Transfer and gets General Error response
transfer To Bank got General Error (will mock by amount)
beneficiaryAccountNumber: 8121111111
Expected Response
Not verified
Returns responseCode 5004300 with responseMessage General Error
In App Partner Action
Merchant shows generic failure message and asks user to retry
Suspected Fraud
Not Tested
Test Scenario
Merchant Requests Transfer to Bank and gets Suspected Fraud response
POST /v1.0/emoney/transfer-bank.htm api call
API returns success with code 4034303
Use beneficiaryAccountNumber: 82298055100
Expected Response
Not verified
Returns responseCode 4034303 with responseMessage Suspected Fraud
In App Partner Action
-

Internal Server Error
Not Tested
Test Scenario
Merchant Requests Transfer to Bank and gets Internal Server Error response
POST /v1.0/emoney/transfer-bank.htm api call
API returns success with code 5004301
Use beneficiaryAccountNumber: 8551008794
Expected Response
Not verified
Returns responseCode 5004301 with responseMessage Internal Server Error
In App Partner Action
-
