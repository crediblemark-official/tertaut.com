Payment Gateway Testing Scenarios
Mandatory API Testing
0 of 0
We require our merchants to test core API scenarios for compliance purposes. Complete the scenarios below using your testing credentials and we’ll automatically verify your test scenarios.
Payment Gateway Payment
POST
/payment-gateway/v1.0/debit/payment-host-to-host.htm
0 of 5 completed
Successfully requests Create Order (2005400)
Not Tested
Test Scenario
Merchant Requests Create Order and gets SUCCESS Response (2005400). You can check our request sample in DANA API Docs.
POST /payment-gateway/v1.0/debit/payment-host-to-host.htm

// Kindly do the positive case where create order is success

// You can refer and copy our request sample for success scenario and adjust the values to your preference

API Response includes `responseMessage` Success with `responseCode` 2005400
Expected Response
Not verified
returns `responseCode` 2005400 with `responseMessage` Successful
In App Partner Action
Displaying webRedirectUrl to the users
Missing or Invalid Format on Any Mandatory Field (4005402)
Not Tested
Test Scenario
Merchant sends request missing `X-TIMESTAMP` or `CHANNEL-ID` and gets `Invalid Mandatory Field` response
POST /payment-gateway/v1.0/debit/payment-host-to-host.htm with missing or invalid X-TIMESTAMP header

// Use this parameter below:

X-TIMESTAMP: null
Expected Response
Not verified
Returns `responseCode` 4005402 with `responseMessage` Invalid Mandatory Field X-TIMESTAMP
In App Partner Action
-

Invalid Field Format (4005401)
Not Tested
Test Scenario
Merchant sends request with invalid field format and gets Invalid Field Format response
POST /payment-gateway/v1.0/debit/payment-host-to-host.htm with invalid format for `amount` or `X-TIMESTAMP`
Expected Response
Not verified
Returns `responseCode` 4005401 with `responseMessage` Invalid Field Format amount
In App Partner Action
-

Inconsistent Request (4045418)
Not Tested
Test Scenario
Merchant creates another order with same value of `partnerReferenceNo` as previous order but with different `amount` and gets `Inconsistent Request` response
POST /payment-gateway/v1.0/debit/payment-host-to-host.htm with same `partnerReferenceNo` but different amount:

// How to Replicate:

// 1st Order:
{
"partnerReferenceNo": "2020102900000000000001",
"amount": {
"value": "100000.00",
"currency": "IDR"
}
}

// 2nd Order:
{
"partnerReferenceNo": "2020102900000000000001",
"amount": {
"value": "200000.00", // Amount is Different than the 1st one
"currency": "IDR"
}
}
Expected Response
Not verified
Returns `responseCode` 4045418 with `responseMessage` Inconsistent Request
In App Partner Action
-

General unauthorized error (Invalid Signature)
Not Tested
Test Scenario
Merchant sends request with invalid signature and gets Unauthorized / Invalid Signature response
POST /payment-gateway/v1.0/debit/payment-host-to-host.htm with invalid signature.

Header Request Sample:

X-SIGNATURE: invalid_signature
Expected Response
Not verified
Returns `responseCode` 4015400 with `responseMessage` Unauthorized. Invalid Signature
In App Partner Action
-

General Payment finish notify
POST
/v1.0/debit/notify
0 of 3 completed
Acknowledge Transaction Success Notify (00 = Success)
Not Tested
Test Scenario
DANA will send a successful transaction (latestTransactionStatus = 00) notification to your Finish Notify Webhook. Your webhook should acknowledge that the notification has been received and return the following response to DANA:
// DANA sends transaction notification request using POST /v1.0/debit/notify

// You should return the following response

{
"responseCode": "2005600",
"responseMessage": "Successful"
}
Expected Response
Not verified
Respond to the Transaction Success Finish Notify with "responseCode": "2005600" and "responseMessage": "Successful"
In App Partner Action
Mark Finish Notify process as Success
Internal Server Error Response from Partner
Not Tested
Test Scenario
DANA will send a successful transaction (latestTransactionStatus = 00) notification to your Finish Notify Webhook. Your webhook should simulate an internal server error and return the following response to DANA:
// DANA sends transaction notification request using POST /v1.0/debit/notify

// You should return the following response

{
"responseCode": "5005601",
"responseMessage": "Internal Server Error"
}
Expected Response
Not verified
Respond to the Transaction Success Finish Notify with "responseCode": "5005601" and "responseMessage": "Internal Server Error"
In App Partner Action
Mark Finish Notify process as Pending. Retry periodically within 7 days
Acknowledge Transaction Closed/Expired Notify (05 = Cancelled)
Not Tested
Test Scenario
DANA will send a Closed/Expired transaction (latestTransactionStatus = 05) notification to your Finish Notify Webhook. Your webhook should acknowledge that the notification has been received and return the following response to DANA:
// DANA sends transaction notification request using POST /v1.0/debit/notify

// You should return the following response

{
"responseCode": "2005600",
"responseMessage": "Successful"
}
Expected Response
Not verified
Respond to the Closed/Expired Transaction Finish Notify with "responseCode": "2005600" and "responseMessage": "Successful"
In App Partner Action
Mark Finish Notify process as Success
Additional API Testing
While these scenarios are not mandatory to receive production credentials, we recommend you test these scenarios to ensure service reliability.
Feel free to try the additional scenarios below. However, if you decide to use any of the APIs listed below, you will need to complete every testing scenarios relating to that API to apply for production credentials.
Payment Gateway Consult Pay
POST
/v1.0/payment-gateway/consult-pay.htm
Not Started
Consult Pay Balanced Success (2005700)
Not Tested
Test Scenario
Merchant requests Consult Pay and gets a list of available payment methods
POST /v1.0/payment-gateway/consult-pay.htm with valid `merchantId` and `amount`
Expected Response
Not verified
Returns `responseCode` 2005700 with `responseMessage` Successful and `paymentInfos` array
In App Partner Action
List of available payment methods to be shown to user
Consult Pay Balanced Invalid Field Format (4000001)
Not Tested
Test Scenario
Merchant requests Consult Pay with invalid merchantId and gets error response
POST /v1.0/payment-gateway/consult-pay.htm with empty `merchantId`
Expected Response
Not verified
Returns `responseCode` 4000001 with `responseMessage` MerchantId can not be empty
In App Partner Action
(null)
Consult Pay Balanced Invalid Mandatory Field (4000002)
Not Tested
Test Scenario
Merchant requests Consult Pay with invalid credentials and gets Unauthorized response
POST /v1.0/payment-gateway/consult-pay.htm with `unauthorized request`
Expected Response
Not verified
Returns `responseCode` 4000002 with `responseMessage` Unauthorized
In App Partner Action
(null)
Payment Gateway Debit Status
POST
/payment-gateway/v1.0/debit/status.htm
Not Started
Successful - Final (00 = Success)
Not Tested
Test Scenario
Merchant queries payment status and gets Successful response with Final status
POST /payment-gateway/v1.0/debit/status.htm api call
API returns success with `responseCode` 2005500 and `latestTransactionStatus` 00
Expected Response
Not verified
Returns `responseCode` 2005500 with `responseMessage` Successful, `latestTransactionStatus` 00
In App Partner Action
Order has been paid
Successful - Pending (01 = Pending)
Not Tested
Test Scenario
Merchant queries payment status and gets Successful response with Pending status
POST /payment-gateway/v1.0/debit/status.htm api call
API returns success with `responseCode` 2005500 and `latestTransactionStatus` 01
Expected Response
Not verified
Returns `responseCode` 2005500 with `responseMessage` Successful, `latestTransactionStatus` 01
In App Partner Action
Order still pending
Successful - Cancelled (05 = Cancelled)
Not Tested
Test Scenario
Merchant queries payment status and gets Successful response with Cancelled status
POST /payment-gateway/v1.0/debit/status.htm api call
API returns success with `responseCode` 2005500 and `latestTransactionStatus` 05
Expected Response
Not verified
Returns `responseCode` 2005500 with `responseMessage` Successful, `latestTransactionStatus` 05
In App Partner Action
Order has been cancelled
Transaction Not Found (4045501)
Not Tested
Test Scenario
Merchant queries a transaction that does not exist and gets Transaction Not Found response
POST /payment-gateway/v1.0/debit/status.htm api call

// You can Trigger this scenario with this request below for reference

Request:
{
"original`partnerReferenceNo`": "12345678",
// rest of body request..
}
Expected Response
Not verified
Returns `responseCode` 4045501 with `responseMessage` Transaction Not Found
In App Partner Action
-

Invalid Mandatory Field (4005502)
Not Tested
Test Scenario
Merchant sends request with missing or invalid mandatory field and gets Invalid Mandatory Field response
POST /payment-gateway/v1.0/debit/status.htm api call
API returns error with `responseCode` 4005502

// With missing or invalid X-TIMESTAMP header

X-TIMESTAMP: null
Expected Response
Not verified
Returns `responseCode` 4005502 with `responseMessage` Invalid Mandatory Field {mandatory field}
In App Partner Action
-

Internal Server Error (5005501)
Not Tested
Test Scenario
Merchant sends request and gets Internal Server Error response
POST /payment-gateway/v1.0/debit/status.htm api call
API returns error with `responseCode` 5005501

// To trigger this scenario, use `serviceCode`: "AZ"

{
// Body request here
"serviceCode": "AZ",
// Rest of body request…
}
Expected Response
Not verified
Returns `responseCode` 5005501 with `responseMessage` Internal Server Error
In App Partner Action
-

Unauthorized / Invalid Signature (4015500)
Not Tested
Test Scenario
Merchant sends request with invalid signature and gets Unauthorized response
POST /payment-gateway/v1.0/debit/status.htm api call
API returns error with `responseCode` 4015500

Header Request Sample:

X-SIGNATURE: invalid_signature
Expected Response
Not verified
Returns `responseCode` 4015500 with `responseMessage` Unauthorized. {reason}
In App Partner Action
-

Payment Gateway Refund Order
POST
/payment-gateway/v1.0/debit/refund.htm
Not Started
Successfully requests Refund Order (2005800)
Not Tested
Test Scenario
Merchant Requests Refund Order and gets success response. Please check our API Docs for the sample Request.
POST /payment-gateway/v1.0/debit/refund.htm api call

// You can check our API Docs for Refund Order API to get the sample request

// It is expected that API returns Success with `responseCode` 2005800
Expected Response
Not verified
Returns `responseCode` 2005800 with `responseMessage` success
In App Partner Action
Refund mark as successful, User able to see refunded transaction in transaction history
Request In Progress requests Refund Order (2025800)
Not Tested
Test Scenario
Merchant Requests Refund Order and gets Request In Progress response.
POST /payment-gateway/v1.0/debit/refund.htm api call

// You can reproduce this scenario by adding `value`: "225800.00" in `refundAmount`

Sample Request:
{
// Start body request here…
"refundAmount": {
"value": "225800.00",
"currency": "IDR"
},
// Rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 2025800 with `responseMessage` Request In Progress
In App Partner Action
Refund mark as pending
Refund not allowed by agreement (4035815)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets error Transaction Not Permitted
POST /payment-gateway/v1.0/debit/refund.htm api call

// You can reproduce this scenario by adding `value`: "435815.00" in `refundAmount`

Sample Request:
{
// Start body request here…
"refundAmount": {
"value": "435815.00",
"currency": "IDR"
},
// Rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 4035815 with `responseMessage` Transaction Not Permitted
In App Partner Action
Refund mark as failed
Inconsistent Request (4045818)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets error Inconsistent Request
POST /payment-gateway/v1.0/debit/refund.htm api call

// For this scenario, you need to first create a successful transaction

// Then use the same `orderId` but a different `refundAmount`

Sample Request:
{
// Start body request here…
"originalPartnerReferenceNo": "${partnerReferenceNo}",
"partnerRefundNo": "${partnerReferenceNo}",
"refundAmount": {
"value": "435815.00",
"currency": "IDR"
},
// Rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 4045818 with `responseMessage` Inconsistent Request
In App Partner Action
Refund mark as failed
Refund Failed due to Order is Not Paid or Expired (4045800)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets error Invalid Transaction Status
POST /payment-gateway/v1.0/debit/refund.htm api call
API returns success with code 4045800
Expected Response
Not verified
Returns `responseCode` 4045800 with `responseMessage` Invalid Transaction Status
In App Partner Action
Refund mark as failed
Invalid Field Format (4005801)
Not Tested
Test Scenario
Merchant Requests CPM Payment and gets Invalid Field Format response
POST /payment-gateway/v1.0/debit/refund.htm api call
API returns success with code 4005801
Expected Response
Not verified
Returns `responseCode` 4005801 with `responseMessage` Invalid Field Format {…….}
In App Partner Action
Refund mark as failed
Missing Mandatory Field (4005802)
Not Tested
Test Scenario
Merchant Requests CPM Payment with used `partnerReferenceNo` and gets Missing Mandatory Field response
POST /payment-gateway/v1.0/debit/refund.htm api call
API returns success with code 4005802
Expected Response
Not verified
Returns `responseCode` 4005802 with `responseMessage` Missing Mandatory Field {………}
In App Partner Action
Refund mark as failed
Refund failed due to order is not exist (4045801)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets error Transaction Not Found
POST /payment-gateway/v1.0/debit/refund.htm api call
API returns success with code 4045801
Expected Response
Not verified
Returns `responseCode` 4045801 with `responseMessage` Transaction Not Found
In App Partner Action
Refund mark as failed
Refund failed due to Insufficient Merchant Balance (4035814)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets error Insufficient Funds
POST /payment-gateway/v1.0/debit/refund.htm api call

// You can reproduce this scenario by adding `value`: "435814.00" in `refundAmount`

Sample Request:
{
// Start body request here…
"refundAmount": {
"value": "435814.00",
"currency": "IDR"
},
// Rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 4035814 with `responseMessage` Insufficient Funds
In App Partner Action
Refund mark as failed
Invalid Signature (4015800)
Not Tested
Test Scenario
Merchant Requests CPM Payment with used `partnerReferenceNo` and gets Unauthorized Signature response
POST /payment-gateway/v1.0/debit/refund.htm api call
API returns success with code 4015800

Header Request Sample:
X-SIGNATURE: invalid_signature
Expected Response
Not verified
Returns `responseCode` 4015800 with `responseMessage` Unauthorized Signature
In App Partner Action
Refund mark as failed
Internal Server Error (5005801)
Not Tested
Test Scenario
Merchant Requests with used `partnerReferenceNo` and gets Internal Server Error response
POST /payment-gateway/v1.0/debit/refund.htm api call

// You can reproduce this scenario by adding `value`: "505801.00" in `refundAmount`

Sample Request:
{
// Start body request here…
"refundAmount": {
"value": "505801.00",
"currency": "IDR"
},
// Rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 5005801 with `responseMessage` Internal Server Error
In App Partner Action
-

Merchant Status Abnormal (4045808)
Not Tested
Test Scenario
Merchant Requests CPM Payment with used `partnerReferenceNo` and gets Merchant Status Abnormal response
POST /payment-gateway/v1.0/debit/refund.htm api call

// You can reproduce this scenario by adding `value`: "445808.00" in `refundAmount`

Sample Request:
{
// Start body request here…
"refundAmount": {
"value": "445808.00",
"currency": "IDR"
},
// Rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 4045808 with `responseMessage` Merchant Status Abnormal
In App Partner Action
Refund mark as failed
Payment Gateway Cancel Order
POST
/payment-gateway/v1.0/debit/cancel.htm
Not Started
Cancel Order Success (2005700)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets success response
POST /payment-gateway/v1.0/debit/cancel.htm api call

// You can reproduce this scenario by creating a success transaction first

Request Sample:
{
"original`partnerReferenceNo`": "2020102900000000000001",
"originalReferenceNo": "2020102977770000000009",
"originalExternalId": "30443786930722726463280097920912",
"merchantId": "23489182303312",
"subMerchantId": "23489182303312",
"reason": "Network timeout",
"externalStoreId": "124928924949487",
"amount": {
"value": "10000.00",
"currency": "IDR"
},
"additionalInfo": {}
}
Expected Response
Not verified
Returns `responseCode` 2005700 with `responseMessage` Success
In App Partner Action
Cancel mark as successful
Cancel in Progress (2025700)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets Request In Progress response
POST /payment-gateway/v1.0/debit/cancel.htm api call

// You can reproduce this scenario by adding `partnerReferenceNo`: "2025700"

{
"`partnerReferenceNo`": "2025700"
// rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 2025700 with `responseMessage` Request In Progress
In App Partner Action
Cancel mark as pending
Transaction Not Permitted (4035705)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets Error Do Not Honor (4035705)
POST /payment-gateway/v1.0/debit/cancel.htm api call

// You can reproduce this scenario by adding `partnerReferenceNo`: "4035705"

{
"`partnerReferenceNo`": "4035705"
// rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 4035705 with `responseMessage` Do Not Honor
In App Partner Action
Cancel mark as failed
Merchant Status Abnormal (4045708)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets Invalid Merchant response
POST /payment-gateway/v1.0/debit/cancel.htm api call

// You can reproduce this scenario by adding `partnerReferenceNo`: "4045708"

{
"`partnerReferenceNo`": "4045708"
// rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 4045708 with `responseMessage` Invalid Merchant
In App Partner Action
Cancel mark as failed
Missing Mandatory Field/Parameter (4005702)
Not Tested
Test Scenario
Merchant Requests Cancel Order with used `partnerReferenceNo` and gets Missing Mandatory Field response
POST /payment-gateway/v1.0/debit/cancel.htm api call

with missing or invalid X-TIMESTAMP header

X-TIMESTAMP: null
Expected Response
Not verified
Returns `responseCode` 4005702 with `responseMessage` Missing Mandatory Field {………}
In App Partner Action
Cancel mark as failed
Cancel Failed due to Exceed Cancel Window Time (4035700)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets Transaction Expired response
POST /payment-gateway/v1.0/debit/cancel.htm api call

// You can reproduce this scenario by adding `partnerReferenceNo`: "4035700"

{
"`partnerReferenceNo`": "4035700"
// rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 4035700 with `responseMessage` Transaction Expired
In App Partner Action
Cancel mark as failed
Cancel Not Allowed by Agreement (4035715)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets Transaction Not Permitted response
POST /payment-gateway/v1.0/debit/cancel.htm api call

// You can reproduce this scenario by adding `partnerReferenceNo`: "4035715"

{
"`partnerReferenceNo`": "4035715"
// rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 4035715 with `responseMessage` Transaction Not Permitted
In App Partner Action
Cancel mark as failed
Cancel Failed due to Insufficience of Merchant Balance (4035714)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets Insufficient Funds response
POST /payment-gateway/v1.0/debit/cancel.htm api call

// You can reproduce this scenario by adding `partnerReferenceNo`: "4035714"

{
"`partnerReferenceNo`": "4035714"
// rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 4035714 with `responseMessage` Insufficient Funds
In App Partner Action
Cancel mark as failed
Cancel Failed due to Order has been Refunded (4045700)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets Invalid Transaction Status response
POST /payment-gateway/v1.0/debit/cancel.htm api call

// To reproduce this scenario, you must refund a success transaction first

// Once you have done refund, input the original`partnerReferenceNo` to this API to get the Invalid Transaction Status
Expected Response
Not verified
Returns `responseCode` 4045700 with `responseMessage` Invalid Transaction Status
In App Partner Action
Cancel mark as failed
Invalid Signature (4015700)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets Unauthorized. Invalid Signature response
POST /payment-gateway/v1.0/debit/cancel.htm api call
API returns error with code 4015700

Header Request Sample:

X-SIGNATURE: invalid_signature
Expected Response
Not verified
Returns `responseCode` 4015700 with `responseMessage` Unauthorized. Invalid Signature
In App Partner Action
Cancel mark as failed
Timeout (5005701)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets Internal Server Error (Timeout) response
POST /payment-gateway/v1.0/debit/cancel.htm api call

// You can reproduce this scenario by adding `partnerReferenceNo`: "5005701"

{
"`partnerReferenceNo`": "5005701"
// rest of body request here…
}
Expected Response
Not verified
Returns `responseCode` 5005701 with `responseMessage` Internal Server Error
In App Partner Action
Cancel mark as failed
Transaction Not Found (4045701)
Not Tested
Test Scenario
Merchant Requests Cancel Order and gets Transaction Not Found response
POST /payment-gateway/v1.0/debit/cancel.htm api calll

// You can Trigger this scenario with this request below for reference

Request:
{
"original`partnerReferenceNo`": "12345678",
// rest of body request..
}
Expected Response
Not verified
Returns `responseCode` 4045701 with `responseMessage` Transaction Not Found
In App Partner Action
Cancel mark as failed
