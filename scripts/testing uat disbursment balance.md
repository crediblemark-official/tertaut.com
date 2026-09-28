Disburse to Balance Testing Scenarios
Mandatory API Testing
0 of 0
We require our merchants to test core API scenarios for compliance purposes. Complete the scenarios below using your testing credentials and we’ll automatically verify your test scenarios.
Dana Disbursement TopUp
POST
/rest/v1.0/emoney/topup
0 of 7 completed
Successfully requests Disbursement Top Up
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up and gets success response
POST /rest/v1.0/emoney/topup api call
API returns success with code 2003800
Use customerNumber 62811742234/62817345544/62817345545 and low amount value 1 to 10 IDR
Expected Response
Not verified
returns responseCode 2003800 with responseMessage Successful
In App Partner Action
Merchant shows success transaction to user
Error Insufficient Fund when request Disbursement Top Up
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up and gets Insufficient Fund error
POST /rest/v1.0/emoney/topup api call
API returns success with code 4033814
Use customerNumber 6281298055129 and amount value 50000000000 IDR
Expected Response
Not verified
returns responseCode 4033814 with responseMessage Insufficient Fund
In App Partner Action
Merchant shows appropriate error message and does not cut user's account balance
Error Do Not Honor when request Disbursement Top Up
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up and gets Do Not Honor error
POST /rest/v1.0/emoney/topup api call
API returns success with code 4033805
Use customerNumber 628996647679/628123456667/628152768647 and low amount value 1 to 10 IDR
Expected Response
Not verified
returns responseCode 4033805 with responseMessage Do Not Honor
In App Partner Action
Merchant shows appropriate error message either payee user not exist or disable
Error Invalid Mandatory Field when request Disbursement Top Up
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up with missing mandatory field
POST /rest/v1.0/emoney/topup api call
API returns error with code 4003802
Remove param customerNumber
Expected Response
Not verified
returns responseCode 4003802 with responseMessage Invalid Mandatory Field
In App Partner Action
Merchant shows error message and asks merchant to retry with correct input
Error Inconsistent Request when retrying Disbursement Top Up
Not Tested
Test Scenario
Merchant performs retry with inconsistent payload (same reffNo but different amount)
POST /rest/v1.0/emoney/topup api call
API returns error with code 4043818 when retry request inconsistent payload
Expected Response
Not verified
returns responseCode 4043818 with responseMessage Inconsistent Request
In App Partner Action
Merchant shows error message and asks user to retry transaction properly
Error Internal Server Error when request Disbursement Top Up
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up and gets Internal Server Error error
POST /rest/v1.0/emoney/topup api call
API returns success with code 5003801
Use customerNumber 628551008794
Expected Response
Not verified
returns responseCode 5003801 with responseMessage Internal Server Error
In App Partner Action
Merchant shows appropriate error message and holds user's balance until transaction retried
Error General Error when request Disbursement Top Up
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up and gets General Error error
POST /rest/v1.0/emoney/topup api call
API returns success with code 5003800
Use customerNumber 628121111111
Expected Response
Not verified
returns responseCode 5003800 with responseMessage General Error
In App Partner Action
Merchant shows appropriate error message and does not cut user's account balance
Additional API Testing
While these scenarios are not mandatory to receive production credentials, we recommend you test these scenarios to ensure service reliability.
Feel free to try the additional scenarios below. However, if you decide to use any of the APIs listed below, you will need to complete every testing scenarios relating to that API to apply for production credentials.
Dana Disbursement TopUp Inquiry
POST
/rest/v1.0/emoney/account-inquiry
Not Started
Successfully requests account inquiry
Not Tested
Test Scenario
Merchant Requests account inquiry and gets success response
POST /rest/v1.0/emoney/account-inquiry api call
API returns success with code 2003700
Use customerNumber 62811742234/62817345544/62817345545 and low amount value 1 to 10 IDR
Expected Response
Not verified
returns responseCode 2003700 with responseMessage Successful
In App Partner Action
Merchant shows request as successful along with customerName
Error Do Not Honor when request account inquiry
Not Tested
Test Scenario
Merchant Requests account inquiry for user not registered or is frozen and gets Do Not Honor error response
POST /rest/v1.0/emoney/account-inquiry api call
API returns success with code 4033705
Use customerNumber 628123456667/628152768647
Expected Response
Not verified
returns responseCode 4033705 with responseMessage Do Not Honor
In App Partner Action
-

Failed to make an account inquiry on an account that has exceeded the limit
Not Tested
Test Scenario
Merchant Requests account inquiry and gets Exceeds Top Up Amount Limit error response
POST /rest/v1.0/emoney/account-inquiry api call
API returns success with code 4033702
Use amount 21000000
Expected Response
Not verified
returns responseCode 4033702 with responseMessage Exceeds Top Up Amount Limit
In App Partner Action
-

Unauthorized Signature
Not Tested
Test Scenario
Merchant Requests account inquiry using invalid signature and gets Unauthorized error response
POST /rest/v1.0/emoney/account-inquiry api call
API returns success with code 4013700
Expected Response
Not verified
returns responseCode 4013700 with responseMessage Unauthorized. Invalid Signature
In App Partner Action
-

Dana Disbursement TopUp Status Inquiry
POST
/rest/v1.0/emoney/topup-status
Not Started
Successfully inquire Disbursement Top Up successful transaction
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up status inquiry and gets success response
POST /rest/v1.0/emoney/topup-status api call
API returns success with code 2003900
Expected Response
Not verified
Returns responseCode 2003900 with responseMessage Successful and latestTransactionStatus 00
In App Partner Action
Merchant shows transaction as successful along with referenceNo, serviceCode, latestTransactionStatus, transactionStatusDesc
Successfully inquire Disbursement Top Up failed transaction
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up status inquiry and gets success response but latestTransactionStatus is 06
POST /rest/v1.0/emoney/topup-status api call
Data Test:
customerNumber : 6281298055138 and amount: 1 IDR
Steps:
Merchant performs a retry mechanism by sending the same payload on topup. If still does not get a response, the merchant can make a top up retry call at least 5 times, before making a status inquiry request
Expected Response
Not verified
Returns responseCode 2003900 with responseMessage Successful and latestTransactionStatus 06
In App Partner Action
Merchant shows transaction as successful along with referenceNo, serviceCode, latestTransactionStatus, transactionStatusDesc
Top Up Not Found
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up status inquiry and gets Top Up Not Found response
POST /rest/v1.0/emoney/topup-status api call
API returns success with code 4043901
Expected Response
Not verified
Returns responseCode 4043901 with responseMessage Top Up Not Found
In App Partner Action
-

Invalid Field Format
Not Tested
Test Scenario
Merchant Requests Disbursement Top Up status inquiry and gets Invalid Field Format response
POST /rest/v1.0/emoney/topup-status api call
API returns success with code 4003901
Use serviceCode XX
Expected Response
Not verified
Returns responseCode 4003901 with responseMessage Invalid Field Format
In App Partner Action
-

Resources
Automated UAT Script
Save days of testing time using our automated test script.
Logs
API Log
Monitor all API calls you have made to DANA.
Webhook Log
What we sent to your callback URL
Transaction History
View detailed sandbox transactions.
Integration Guide
Read our developer guide for Disburse to Balance feature
