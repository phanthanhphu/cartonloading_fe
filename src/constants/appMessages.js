export const APP_MESSAGES = Object.freeze({
  UNEXPECTED_ERROR: 'An unexpected error occurred.',
  LOGIN_SUCCESS: 'Login successful.',
  LOGIN_REQUIRED_FIELDS: 'Please enter your email, password, and select a Buyer.',
  LOGIN_BUYER_ACCESS_DENIED: 'Your account does not have permission to access the selected Buyer.',
  LOGIN_BUYER_INVALID: 'The selected Buyer is invalid. Please select another Buyer.',
  LOGIN_TOKEN_MISSING: 'Login response does not include an authentication token. Please contact the system administrator.',
  LOGIN_BAD_CREDENTIALS: 'The email or password is incorrect. Please try again.',
  LOGIN_ACCOUNT_DISABLED: 'Your account has been disabled. Please contact the system administrator.',
  LOGIN_SERVER_UNREACHABLE: 'Unable to connect to the Order Scan server.',

  PAGE_OPEN_FAILED: 'Unable to open this page',
  RELOAD_PAGE: 'Reload Page',
  SESSION_EXPIRED: 'Session expired. Please sign in again.',
  API_URL_UNDEFINED: 'API URL is undefined. Please check caller file.',
  FETCH_URL_UNDEFINED: 'Fetch URL is undefined. Please check the file calling fetch().',
  GENERATED_PASSWORD_MISSING: 'Server did not return the generated password',
  CODE128_EVEN_DIGITS_REQUIRED: 'Code 128-C requires an even number of numeric digits.',
  SELECT_ORDER_FIRST: 'Select an Order first.',
  BUYER_WORKFLOW_FUNCTION_UNAVAILABLE: 'This function is not part of the selected Buyer workflow.',
  BUYER_WORKFLOW_PAGE_MISMATCH: 'This page does not belong to the selected Buyer workflow.',
  BUYER_WORKSPACE_ACCESS_DENIED: 'You do not have access to the Buyer workspace.',
  FACTORY_OPERATIONS_ONLY: 'Access denied. This account is limited to Factory Operations.',
  ASSIGN_BARCODE_REQUIRED: 'Access denied. Assign Barcode permission is required.',
  WEIGHT_CHECK_REQUIRED: 'Access denied. Weight Check permission is required.',
  PACKING_PERMISSION_REQUIRED: 'Access denied. Packing permission is required.',
  WEIGHING_PERMISSION_REQUIRED: 'Access denied. Weighing permission is required.',
  PRINT_ROOM_PERMISSION_REQUIRED: 'Access denied. Print Room or Packing permission is required.',
  ASSIGN_BARCODE_BUYER_REQUIRED: 'Access denied. Assign Barcode permission is required for this Buyer.',
  WEIGHT_CHECK_BUYER_REQUIRED: 'Access denied. Weight Check permission is required for this Buyer.',
  ADMIN_ONLY: 'Access denied. Administrator only.',
  UNABLE_LOAD_ORDERS: 'Unable to load Orders.',
  PLEASE_CHECK_FILE: 'Please check the file.',
  OPERATION_FAILED: 'Operation failed.',
  CHECKING_OPERATION_FAILED: 'Unable to complete carton QC checking.',
  CHECKING_NOT_FOUND: 'No matching PO, SKU, or SSCC found in this Order.',
  CHECKING_SSCC_REQUIRED: 'Assign SSCC in Packing before recording a QC result.',
  CHECKING_IDENTIFY_FIRST: 'Complete carton identification in Packing before recording QC PASS.',
  CHECKING_FAIL_REASON_REQUIRED: 'Enter a failure reason of at least 3 characters.',

  COMPLETE_OPERATION_FAILED: 'Unable to complete the operation.',
  LOAD_SHIPMENT_PLANS_FAILED: 'Unable to load shipment plans.',
  LOAD_BARCODE_ASSIGNMENT_ORDERS_FAILED: 'Unable to load Orders for Barcode Assignment.',
  LOAD_WEIGHT_CHECK_ORDERS_FAILED: 'Unable to load Orders for Weight Check.',
  LOAD_SCAN_SETUP_FAILED: 'Unable to load the selected Order scan setup.',
  WEIGHT_CHECK_REQUIRES_FULL_BARCODE_ASSIGNMENT: 'Weight Check can start only after Barcode Assignment reaches 100%.',
  SCAN_FACTORY_BARCODE_REQUIRED: 'Scan or enter a Factory Barcode.',
  SCAN_ASSIGNED_FACTORY_BARCODE_REQUIRED: 'Scan or enter an assigned Factory Barcode.',
  IDENTIFY_CARTON_FAILED: 'Unable to identify the carton from this Factory Barcode.',
  NO_WSP_ITEM_MATCH: 'No matching item was found in the WSP data.',
  LOAD_CARTON_LIST_FAILED: 'Unable to load the carton list.',
  LOAD_SCALE_STATIONS_FAILED: 'Unable to load Scale Stations.',
  SCAN_FACTORY_BARCODE_FAILED: 'Unable to scan the Factory Barcode.',
  VALID_WEIGHT_REQUIRED: 'Enter a valid weight greater than 0 kg.',
  SAVE_MANUAL_WEIGHT_FAILED: 'Unable to save the manual weight.',
  FACTORY_CODE_FORMAT: 'Factory Code must contain exactly 3 digits, for example 002.',
  GENERATE_QUANTITY_RANGE: 'Generate quantity must be between 1 and 1000.',
  PRINT_WINDOW_BLOCKED: 'The browser blocked the print window. Allow pop-ups for this site and try again.',
  SHIPMENT_FORM_REQUIRED: 'Select an Order and cartons, then enter shipment number, destination and date.',
  INSPECTION_NOTE_REQUIRED: 'An inspection note is required.',
  SAVED_SUCCESSFULLY: 'Saved successfully.',
  EXPORT_FILTER_RETRY: 'Export failed. Narrow the report filters and retry.',
  SKU_LOOKUP_FAILED: 'SKU lookup failed.',
  LABEL_CONFIRMED_SSCC_UNLOCKED: 'System Unit Qty confirmed. SKU is linked to the logical PO and SSCC scanning is now unlocked.',
  SSCC_ASSIGNMENT_FAILED: 'SSCC assignment failed.',
  TRACE_NO_MATCH: 'No PO / SKU / Carton / SSCC matched this Order.',
  LOAD_PO_FAILED: 'Unable to load PO.',
  LOAD_PURCHASE_ORDERS_FAILED: 'Unable to load Purchase Orders.',
  LOAD_PO_HANDOFFS_FAILED: 'Unable to load Print Requests.',
  SEND_PO_LIST_FAILED: 'Unable to send PO list.',
  DELETE_PRINT_REQUEST_FAILED: 'Unable to delete Print Request.',
  PRINT_LIST_PAGE_SUBTITLE: 'Packing sends selected PO information to the print-list queue. This page manages the list for printing only; it does not connect to or control a printer.',
  PRINT_LIST_QUEUE_SUBTITLE: 'View the Packing owner, Factory, Order and exact POs in the print list. This is list management only; no printer connection is used.',
  SCAN_REJECTED: 'Scan rejected.',
  LAST_SCAN_REMOVED: 'Last scan removed.',
  ALL_CARTONS_FINISHED: 'All cartons for this PO are finished.',
  LOAD_ORDER_FAILED: 'Unable to load Order.',
  MASTER_DATA_IMPORT_FAILED: 'Master Data import failed.',
  ALL_BP_IMPORT_FAILED: 'ALL_BP import failed.',
  SHIPPING_LIST_IMPORT_FAILED: 'Shipping List import failed.',
  ALL_BP_SOURCE_ROW_REQUIRED: 'ALL_BP source row is required.',
  ALL_BP_PO_REQUIRED: 'PO is required in ALL_BP.',
  ALL_BP_STYLE_REQUIRED: 'Style# is required in ALL_BP.',
  ALL_BP_QUANTITY_RULE: "Q'ty and Pcs/ctn must be positive whole numbers in every ALL_BP row.",
  UPDATE_PO_FAILED: 'Unable to update PO.',
  PO_UPDATED_REBUILT: 'PO updated. ALL_BP formulas were recalculated and any previously generated Cartons/Items were rebuilt from the new data.',
  DELETE_PO_FAILED: 'Unable to delete PO.',
  LOAD_CARTONS_FAILED: 'Unable to load Cartons.',
  LOAD_ORDERS_FAILED: 'Unable to load Orders.',
  SAVE_ORDER_FAILED: 'Unable to save Order.',
  DELETE_ORDER_FAILED: 'Unable to delete Order.',
  LOAD_ITEMS_FAILED: 'Unable to load Items.',
  CARTON_MASTER_GENERATION_FAILED: 'Unable to generate Carton Master from Master Total ctns.',
  PACKING_LIST_GENERATION_FAILED: 'The Packing List could not be generated.',
  PACKING_LIST_GENERATED: 'Packing List generated.',
  ORDER_ITEMS_IMPORT_FAILED: 'Order Items import failed.',
  PACKING_LIST_IMPORT_FAILED: 'Packing List import failed.',
  LOAD_ORDER_ITEMS_FAILED: 'Unable to load Order Items.',
  LOAD_PACKING_LIST_ROWS_FAILED: 'Unable to load Packing List rows.',
  LOAD_ORDER_LIST_FAILED: 'Unable to load the Order list.',
  LOAD_ORDER_INFO_FAILED: 'Unable to load Order information.',
  LOAD_MASTER_ROWS_FAILED: 'Unable to load Master rows for Barcode Assignment.',
  LOAD_PHYSICAL_CARTONS_FAILED: 'Unable to load physical cartons for the selected Master row.',
  GENERATE_FACTORY_BARCODES_FAILED: 'Unable to generate Factory Barcodes.',
  VOID_FACTORY_BARCODE_FAILED: 'Unable to VOID Factory Barcode.',
  UNASSIGN_FACTORY_BARCODE_FAILED: 'Unable to unassign Factory Barcode.',
  ASSIGN_FACTORY_BARCODE_FAILED: 'Unable to assign Factory Barcode to this physical carton.',
  PACK_ASSIGN_CARTON_FAILED: 'Unable to pack and assign the selected physical carton.',
  SAVE_SCALE_STATION_FAILED: 'Unable to save the scale station.',
  CAMERA_PERMISSION_DENIED: 'Camera permission was not granted.',
  CAMERA_OPEN_FAILED: 'Unable to open the camera. Mobile camera access usually requires HTTPS.',
  BARCODE_DETECTOR_UNSUPPORTED: 'This browser does not support BarcodeDetector. Use a Bluetooth scanner or enter the code manually.',
  SELECT_SCALE_STATION_FIRST: 'Select a scale station first.',
  SELECT_ORDER_FIRST_MOBILE: 'Select an Order first.',
  SCAN_ITEM_LABEL_FIRST: 'Scan the item label first.',
  QA_PROCESS_FAILED: 'Unable to process the QA Code.',
  CHECK_WAITING_JOB_FAILED: 'Unable to check the waiting Job.',
  CREATE_PLC_JOB_FAILED: 'Unable to create a Job waiting for PLC.',
  LOAD_ORDER_OR_SCALE_FAILED: 'Unable to load the Order or scale stations.',
  LOAD_ITEM_PROGRESS_FAILED: 'Unable to load item progress.',
  LOAD_CHILD_ITEMS_FAILED: 'Unable to load the child item list.',
  MATCH_BARCODE_ORDER_FAILED: 'Unable to match the barcode with the Order data.',
  REQUEST_FAILED: 'Request failed.',
  SSCC_ACCEPTED: 'SSCC accepted.',
  WEIGHT_PROFILE_SAVED: 'Weight profile saved.',
  GENERATION_FAILED: 'generation failed',
  EXPORT_FAILED: 'Export failed.',
  BARCODE_ASSIGNMENT_UNAVAILABLE: 'Factory Barcode cannot be used for assignment.',
  FILTER_SINGLE_FACTORY: 'Filter to one Factory before selecting all visible POs.',
  ORDER_ITEM_DELETED: 'Order Item deleted.',
  ORDER_ITEM_SAVED: 'Order Item saved. Packing List / Physical Cartons were synchronized automatically when quantity changed.',
  ORDER_SAVED_SUCCESSFULLY: 'Order saved successfully.',
  PACKING_LIST_ROW_DELETED: 'Packing List row deleted.',
  PACKING_LIST_ROW_SAVED: 'Packing List row saved. Physical Cartons were refreshed using Master Total ctns when carton-related data changed.',
  SCALE_STATION_CREATED: 'Scale station created.',
  SCALE_STATION_UPDATED: 'Scale station updated.',
  SELECT_SCALE_STATION_QA: 'Select a Scale Station before submitting a QA Code.',
  SELECT_ORDER_QA: 'Select an Order before submitting a QA Code.',
  ORDER_DATA_DELETED: 'The Order, Order Items and Packing List data were deleted.',
  CHECK_PLC_JOB_FAILED: 'Unable to check the current PLC Job.',
  DELETE_ORDER_ITEM_FAILED: 'Unable to delete the Order Item.',
  DELETE_ORDER_FULL_FAILED: 'Unable to delete the Order.',
  DELETE_PACKING_LIST_ROW_FAILED: 'Unable to delete the Packing List row.',
  DOWNLOAD_ORDER_ITEMS_FAILED: 'Unable to download the Order Items.',
  DOWNLOAD_PACKING_LIST_FAILED: 'Unable to download the Packing List.',
  GENERATE_PACKING_LIST_FAILED: 'Unable to generate the Packing List.',
  LOAD_FACTORY_BARCODES_FAILED: 'Unable to load Factory Barcodes.',
  LOAD_ORDERS_SCALE_STATIONS_FAILED: 'Unable to load Orders or Scale Stations.',
  LOAD_CARTON_PROGRESS_FAILED: 'Unable to load carton loading progress.',
  LOAD_PHYSICAL_CARTONS_FOR_MASTER_FAILED: 'Unable to load physical cartons for this Master row.',
  LOAD_SCALE_STATIONS_LOWER_FAILED: 'Unable to load scale stations.',
  LOAD_SELECTED_ORDER_FAILED: 'Unable to load the Order.',
  RECORD_PRINT_REQUEST_FAILED: 'Unable to record the print request.',
  RESET_WEIGHT_CHECK_FAILED: 'Unable to reset Weight Check for this carton.',
  SAVE_ORDER_ITEM_FAILED: 'Unable to save the Order Item.',
  SAVE_SELECTED_ORDER_FAILED: 'Unable to save the Order.',
  SAVE_PACKING_LIST_ROW_FAILED: 'Unable to save the Packing List row.',
  SHIPMENT_ORDER_SEARCH_HELPER: 'Search if the Order is not in the first 100 results.',
  FACTORY_CODE_HELPER: 'Exactly 3 digits, for example 002.',
  BARCODE_VALIDATE_FIRST_HELPER: 'Validate the barcode first. Physical cartons will then be enabled for selection.',
  ZEBRA_AUTO_JOB_HELPER: 'The system automatically finds Master Data, selects the next PLANNED carton and creates a PLC weight job.',
  ZEBRA_QA_SUBMIT_HELPER: 'Press Enter or click Submit QA Code.',
  PACKING_SHIPMENT_SCAN_HELPER: 'Only physical cartons in the open shipment are accepted. The scanner may send Enter to confirm.',
  CARTON_QUANTITY_CORRECTION_HELPER: 'Confirm the quantity. If it differs from the plan, ask Sales to correct the plan first.',
  BARCODE_VERIFY_HELPER: 'Scan with the barcode scanner or type the code, then press Enter to verify availability.',
  BUYER_NOT_FOUND: 'Buyer not found.',
  BUYER_ACCESS_NOT_ALLOWED: 'Buyer not found or access is not allowed.',
  SELECT_BUYER_BEFORE_ORDERS: 'Please select a Buyer before opening Orders.',
  NO_BUYER_WORKSPACE: 'No Buyer workspace is available for this user.',
  BUYER_NOT_IDENTIFIED: 'Buyer could not be identified.',
  NO_BUYER_ACCESS: 'No Buyer access is assigned to your account.',
  NO_BUYER_ACCESS_CONTACT_ADMIN: 'No Buyer access is assigned to your account. Contact an administrator.',
  SELECT_BUYER_FIRST: 'Select a Buyer first.',
  AUDIT_LOGS_READ_ONLY: 'Audit logs are read-only and cannot be edited or deleted.',
  BUYER_CONFIGURATION_INFO: 'Buyer is configuration data. Add any Buyer Key you need; MongoDB collections remain shared by business domain. Existing Buyer Keys cannot be changed.',
  BUYER_WORKFLOW_NOT_ASSIGNED: 'This Buyer is configured and can use shared Order data, but no PO/Carton operational workflow module has been assigned yet.',
  SELECT_PO_TO_LOAD_CARTON_QUEUE: 'Select a Purchase Order to load its carton queue.',
  POSITIVE_CARTON_QTY_MATCH_REQUIRED: 'Enter a positive quantity matching the carton plan.',
  PACKING_LIST_REPLACE_WARNING: 'The current Packing List rows will be replaced.',
  CARTON_MASTER_PHYSICAL_ROW_INFO: 'Each generated row represents one physical carton. Master Total ctns controls the number of rows; Qty Per Ctn controls only the planned pieces inside each carton.',
  SCALE_STATION_OTHER_SHIPMENT: 'This scale station is waiting for a carton from another shipment. Finish the active station job first.',
  NO_EXPECTED_WEIGHT_AVAILABLE: 'No expected weight is available, so PASS / FAIL cannot be determined automatically. Contact Sales or an administrator.',
  CARTON_WEIGHT_CHECK_FAILED: 'This carton failed the weight check. Inspect the carton and ask an administrator to reset the weight before rechecking.',
  PLACE_ITEM_ON_SCALE: 'Place the item on the scale. The Gateway will submit the weight to this Job.',
  NO_CARTON_MASTER_ROWS: 'No Carton Master rows are available. Prepare Order Items, verify Master Total ctns, then generate one row per physical carton.',
  ITEM_HAS_NO_PHYSICAL_CARTONS: 'This item has no physical cartons. Regenerate Carton Master from Master Total ctns.',
  FACTORY_BARCODE_READY_SELECT_CARTON: 'Factory Barcode is ready. Select one physical carton above to continue.',
  NO_PHYSICAL_CARTONS_FOR_MASTER: 'No physical cartons are available for this Master row.',
  SHIPMENT_DISPATCH_RULES: 'All cartons in a shipment must pass inspection and be explicitly completed before dispatch. Cancel a planned shipment to release its cartons; dispatched shipments are locked.',
  SHIPMENT_MANUAL_INSPECTION_INFO: 'Manual inspection records PASS/FAIL without inventing a weight. UNDER/OVER weight failures require an Admin reset and a new check.',
  DEFAULT_VOID_REASON: 'Damaged / unused label',
  DEFAULT_SUPERVISOR_REASON: 'Supervisor/Admin correction',
  DEFAULT_CORRECTION_REASON: 'Correction requested by Supervisor/Admin',
  ORDER_BARCODE_ASSIGNMENT_COMPLETED_SUFFIX: ' Order Barcode Assignment is now COMPLETED and ready for Sales Shipment Planning.',

});

export const createBuyerOrderFirstMessage = (buyerCode) => `Create a ${buyerCode} Order before importing PO or scanning cartons.`;
export const createAllBpImportedMessage = (count) => `ALL_BP imported ${count || 0} PO(s). Cartons and Items will be generated only when opened.`;
export const createPoDeletedMessage = (poNumber) => `PO ${poNumber || ''} deleted.`;
export const createSsccAssignedMessage = (sscc, poNumber, cartonNo) => `SSCC ${sscc} assigned to PO ${poNumber}, Carton ${cartonNo}.`;
export const createSkuAssignedMessage = (sku, poNumber) => `SKU ${sku} assigned to PO ${poNumber}.`;
export const createSkuAcceptedMessage = (sku) => `SKU ${sku} accepted.`;
export const createCartonFinishedMessage = (finishedCartonNo, nextCartonNo) => nextCartonNo
  ? `Carton ${finishedCartonNo} finished. Carton ${nextCartonNo} is ready.`
  : APP_MESSAGES.ALL_CARTONS_FINISHED;
export const createFinishedCartonsFoundMessage = (count) => `${count || 0} finished carton(s) found in this Order.`;

export const createPackingListImportCompletedMessage = (created, updated) => `Packing List import completed: ${created || 0} created and ${updated || 0} updated.`;
export const createBarcodeAssignedMessage = (barcode, cartonLabel, completedMessage = '') => `Assigned ${barcode} to ${cartonLabel}.${completedMessage}`;
export const createBarcodeUnassignedMessage = (barcode) => `Factory Barcode ${barcode} was unassigned. Order assignment returned to IN PROGRESS.`;
export const createWeightResetMessage = (cartonLabel) => `Weight Check was reset for ${cartonLabel || 'the selected carton'}. Its Factory Barcode remains assigned; unassign it only when the barcode mapping must be corrected.`;
export const createCartonMasterGeneratedMessage = (message, createdCartons) => `${message} Generated ${Number(createdCartons || 0).toLocaleString('en-US')} physical cartons. Use View Physical Cartons on a Master row to scan and assign barcodes.`;
export const createPackingListGenerationSummary = (message, created, skipped) => `${message || APP_MESSAGES.PACKING_LIST_GENERATED} Created: ${created || 0}; skipped: ${skipped || 0}.`;
export const createJobWaitingMessage = (jobId) => `Job ${jobId} is still waiting for PLC weight.`;
export const createRestoredPlcJobMessage = (jobId) => `Restored PLC Job ${jobId}.`;
export const createPlcWeightReceivedMessage = (weight) => `PLC weight received: ${weight}.`;
export const createRestoredJobWaitingPlcMessage = (jobId) => `Restored Job ${jobId}, which is waiting for PLC.`;
export const createPlcSubmittedWeightMessage = (weight) => `PLC submitted weight ${weight}.`;
export const createStationJobWaitingPlcMessage = (stationCode, jobId) => `Station ${stationCode} already has Job ${jobId} waiting for PLC.`;
export const createChildItemAssignedMessage = (sequence, jobId) => `Child item #${sequence} was assigned to Job ${jobId}. Waiting for PLC.`;
export const createChildItemManualSavedMessage = (sequence, weight) => `Saved child item #${sequence}: ${weight} by manual entry.`;
export const createCartonCompletedWeightMessage = (cartonNo, weight, source) => `Carton ${cartonNo} completed with ${weight} from ${source || 'weight input'}. Scan the next assigned Factory Barcode when the station is ready.`;
export const createBarcodeIdentifiedMessage = (barcode, cartonLabel) => `Factory Barcode ${barcode} identified ${cartonLabel}. The carton is waiting for weight.`;
export const createCartonCompletedManualMessage = (cartonNo, weight) => `Carton ${cartonNo} completed manually with ${weight}. Scan the next assigned Factory Barcode when the station is ready.`;
export const createBarcodesGeneratedMessage = (quantity, batchId) => `Generated ${Number(quantity || 0).toLocaleString()} Factory Barcodes in batch ${batchId || ''}.`;
export const createPrintPreparedMessage = (count) => `Print prepared for ${Number(count || 0).toLocaleString()} label${Number(count || 0) === 1 ? '' : 's'}.`;
export const createBarcodeVoidedMessage = (barcode) => `Factory Barcode ${barcode} is now VOID and will never be reused.`;
export const createShippingListImportedMessage = (updated, warnings = []) => `Shipping List imported. ${updated || 0} PO updated.${warnings.length ? ` ${warnings.length} note(s): ${warnings.join(' | ')}` : ''}`;
export const createAllBpImportDetailMessage = (created, updated, cartons, items, warnings = []) => `ALL_BP imported into this Order: ${created || 0} PO, ${updated || 0} updated, ${cartons || 0} cartons, ${items || 0} item rows.${warnings.length ? ` ${warnings.length} note(s): ${warnings.join(' | ')}` : ''}`;
export const createHandoffSingleFactoryMessage = (selectedFactory, otherFactory) => `One Print Request can contain only one Factory (${selectedFactory}). Send ${otherFactory || 'the other Factory'} separately.`;
export const createHandoffSentMessage = (requestNo, poCount) => `${requestNo} sent with ${poCount} PO(s). Print Room can see it immediately.`;
export const createHandoffCancelledMessage = (requestNo) => `${requestNo} cancelled.`;
export const createHandoffDeletedMessage = (requestNo) => `${requestNo} deleted. Its POs are available to send again.`;
export const createWeighingOrderCreatedMessage = (name) => `Weighing Order ${name} created.`;
export const createCartonReweighOpenMessage = (cartonNo) => `Carton ${cartonNo} is open for Re-weigh.`;
export const createGenerationReviewMessage = (detail) => ` Import completed; generation needs review: ${detail || APP_MESSAGES.GENERATION_FAILED}`;
export const createMasterDataImportedMessage = (buildMessage = '') => `Master Data imported.${buildMessage}`;


export const createLoginSuccessMessage = (buyerLabel) => `Login successful. Opening ${buyerLabel}.`;
export const createArticleFoundMessage = (articleNumber, plannedCartons) => `Article ${articleNumber} found. Select child item 1–${plannedCartons}.`;
export const createArticleAmbiguousMessage = (count) => `${count} items use the same Article. Select the correct Size/Color.`;
export const createCartonWaitingForWeightMessage = (cartonLabel) => `Carton ${cartonLabel} is still waiting for weight. Complete it before scanning another carton.`;
export const createWorkflowNotConfiguredMessage = (buyerCode) => `No operational workflow is configured for Buyer ${buyerCode}.`;
export const createFactoryBarcodeAssignedMessage = (cartonLabel, barcode) => `${cartonLabel} assigned to Factory Barcode ${barcode}.`;
export const createFactoryBarcodeAssignedNextMessage = (message) => `${message} Scan the next Factory Barcode when you are ready.`;
export const createFactoryBarcodeAvailableMessage = (barcode) => `Factory Barcode ${barcode} is available. Select a physical carton below.`;
export const createFactoryBarcodeReleasedMessage = (barcode) => `Factory Barcode ${barcode} was released. This carton is available for packing again.`;
export const createNoPendingCartonForQtyMessage = (qty) => `No pending carton matches Unit Qty ${qty} for this SKU.`;
export const createFactoryBarcodeAvailableForCartonMessage = (barcode) => `Factory Barcode ${barcode} is available for this physical carton.`;
export const createShipmentReadOnlyMessage = (status) => `Shipment status: ${status}. This screen is read-only for completed or inactive plans.`;
export const createItemAssignedStationMessage = (item, stationCode) => `Item ${item} will be assigned to station ${stationCode}.`;
export const createShipmentSelectionStepMessage = (count) => `Step 3: ${count} cartons selected. Enter the shipment information and confirm. A carton can belong to only one active shipment.`;
export const createCompleteCartonConfirmMessage = (barcode) => `Complete carton ${barcode}? Its assignment and inspection data will be locked. This does not ship the carton.`;
export const createDispatchShipmentConfirmMessage = (shipmentNo) => `Confirm that shipment ${shipmentNo} is being shipped. All its cartons will become SHIPPED. This action cannot be undone here.`;
export const createCancelShipmentConfirmMessage = (shipmentNo) => `Cancel plan ${shipmentNo}? Cartons will be released for another plan. Their inspection and completion records are retained.`;
export const createOrderItemsImportSummary = (created, updated, deleted) => `Order Items import: ${created || 0} created, ${updated || 0} updated, ${deleted || 0} deleted. Review the Master Total ctns and Qty Per Ctn before generating Carton Master data.`;
export const createQuantityMismatchMessage = (plannedQuantity) => `Quantity Mismatch. Planned: ${plannedQuantity} pcs. Enter the exact actual quantity before continuing.`;
export const createMasterDataBuildSummary = (packingRows, cartons) => ` ${packingRows || 0} packing row(s), ${cartons || 0} carton(s).`;


export const createUnassignFactoryBarcodeConfirmMessage = (barcode, cartonLabel) => `Unassign Factory Barcode ${barcode} from ${cartonLabel || 'this physical carton'}?`;
export const createVoidFactoryBarcodeReasonMessage = (barcode) => `Reason to VOID ${barcode} (optional):`;
export const createCancelHandoffConfirmMessage = (requestNo) => `Cancel ${requestNo}?`;
export const createDeleteHandoffConfirmMessage = (requestNo) => `Delete ${requestNo} permanently?\n\nOnly the Print Request will be removed. PO, Carton, Item, SKU, SSCC and Packing data will be kept, and the POs can be sent to Print Room again.`;
export const createReweighReasonMessage = (cartonNo) => `Reason for Re-weigh carton ${cartonNo}:`;
export const createOverridePassReasonMessage = (cartonNo) => `Reason to Override FAILED to PASS for carton ${cartonNo}:`;
export const createOverridePassSuccessMessage = (cartonNo) => `Carton ${cartonNo} was overridden from FAILED to PASS. Reason and user were recorded in history.`;

export const createResetSkuReasonMessage = (poNumber) => `Reason for resetting SKU of PO ${poNumber}:`;
export const createResetSkuSuccessMessage = (poNumber) => `PO ${poNumber} SKU and unfinalized scans were reset.`;
export const createReopenCartonReasonMessage = (cartonNo) => `Reason for re-opening carton ${cartonNo}:`;
export const createReopenCartonSuccessMessage = (cartonNo) => `Carton ${cartonNo} re-opened.`;
export const createUnassignSsccReasonMessage = (cartonNo) => `Reason for unassigning SSCC from carton ${cartonNo}:`;
export const createUnassignSsccSuccessMessage = (cartonNo) => `SSCC was unassigned from carton ${cartonNo}.`;
export const createExFtyBulkUpdateMessage = (updated, exFtyDate, failed = []) => failed.length
  ? `${updated} PO updated to ${exFtyDate}. Failed: ${failed.join(', ')}`
  : `${updated} PO updated to Ex-Factory Date ${exFtyDate}.`;

export const createDeleteOrderConfirmMessage = (orderName) => `Delete Order "${orderName || ''}"?`;
export const createDeleteUserConfirmMessage = (username) => `Delete user ${username || ''}?`;
export const createDeleteDepartmentConfirmMessage = (factory, division, departmentName) => `Delete department ${factory || ''} / ${division || ''} / ${departmentName || ''}?`;
export const createDeleteBuyerConfirmMessage = (buyerKey) => `Delete buyer ${buyerKey || ''}?`;
export const createDeleteImportedPoConfirmMessage = (poNumber) => `Delete PO "${poNumber || ''}"?\n\nGenerated Cartons/Items that have not started Packing will also be removed. This cannot be undone.`;
