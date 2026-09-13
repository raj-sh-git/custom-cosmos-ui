/* ==========================================================================
   CosmosUI v2.0 - Core Frontend Script Logic
   Handles Modals, JSON validation, AJAX CRUD, pagination, and dropdowns.
   ========================================================================== */

// --- Dynamic Variables for the Document Editor ---
let activeEditMode = "edit"; // 'edit' or 'create'
let activeDeleteItem = { id: null, pkVal: null };

// --- 1. Dropdown Navigation ---
function toggleDropdown(id) {
    const dropdown = document.getElementById(id);
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Close dropdowns if user clicks outside
window.addEventListener('click', function(e) {
    if (!e.target.closest('.export-group')) {
        document.querySelectorAll('.dropdown-menu').forEach(el => {
            el.classList.remove('active');
        });
    }
});

// --- 2. Generic Modal Actions ---
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // prevent bg scroll
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close modals when clicking backdrop
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal(this.id);
        }
    });
});

// --- 3. Dynamic Search Input Formatting & Query Helpers ---
function toggleSearchMode(mode) {
    const wrapper = document.querySelector('#searchInputGroup .search-input-wrapper');
    if (!wrapper) return;
    
    const inputEl = document.getElementById('search_query');
    const currentVal = inputEl ? inputEl.value : '';
    
    if (mode === 'advanced') {
        wrapper.innerHTML = `
            <i class="fa-solid fa-code search-icon-left" id="searchIcon"></i>
            <textarea name="search_query" id="search_query" rows="2" class="sql-query-textarea"
                placeholder="Enter any Cosmos SQL query (e.g. SELECT * FROM c WHERE c.status = 'active' ORDER BY c._ts DESC)">${currentVal}</textarea>
        `;
        const hints = document.querySelector('.sql-hints-bar');
        if (hints) hints.style.display = 'flex';
    } else {
        wrapper.innerHTML = `
            <i class="fa-solid fa-magnifying-glass search-icon-left" id="searchIcon"></i>
            <input type="text" name="search_query" id="search_query" value="${currentVal}" 
                placeholder="Search by document ID...">
        `;
        const hints = document.querySelector('.sql-hints-bar');
        if (hints) hints.style.display = 'none';
    }
}

function setQueryExample(sql) {
    const textarea = document.getElementById('search_query');
    if (textarea) {
        textarea.value = sql;
        textarea.focus();
    }
}

// --- 4. Pagination / Page Limit Selector (Smart Count Preserved) ---
function changePageSize(size) {
    const url = new URL(window.location.href);
    url.searchParams.set('limit', size);
    url.searchParams.set('page', '1'); // reset to page 1
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.totalItems !== undefined) {
        url.searchParams.set('total_items', CONFIG.totalItems);
    }
    window.location.href = url.toString();
}

// --- 5. Bulk Import Upload File UI ---
function updateFileNameDisplay(input) {
    const display = document.getElementById('importFileName');
    if (display) {
        if (input.files && input.files.length > 0) {
            display.textContent = input.files[0].name;
            display.style.color = '#fff';
            display.style.fontWeight = '500';
        } else {
            display.textContent = "No file chosen";
            display.style.color = '';
            display.style.fontWeight = '';
        }
    }
}

function openImportModal() {
    const fileInput = document.getElementById('importFile');
    if (fileInput) fileInput.value = '';
    
    const display = document.getElementById('importFileName');
    if (display) display.textContent = "No file chosen";
    
    openModal('importModal');
}

// --- 6. JSON Editor Workspace Code Logic ---
const textarea = document.getElementById('jsonEditor');
const errorBanner = document.getElementById('jsonErrorBanner');
const errorMessage = document.getElementById('jsonErrorMessage');
const btnSave = document.getElementById('btnSaveDocument');

if (textarea) {
    textarea.addEventListener('input', validateJsonOnInput);
}

function validateJsonOnInput() {
    const val = textarea.value.strip ? textarea.value.strip() : textarea.value.trim();
    if (!val) {
        setEditorError(true, "Document JSON cannot be empty.");
        return false;
    }
    
    try {
        const obj = JSON.parse(val);
        
        // Ensure id property is present
        if (!obj.hasOwnProperty('id') || String(obj.id).trim() === "") {
            setEditorError(true, "Document must contain a non-empty string 'id' attribute at the top level.");
            return false;
        }

        // Ensure partition key is present
        if (CONFIG && CONFIG.cleanPk) {
            const pkPathParts = CONFIG.cleanPk.split('/');
            // For simple top-level partition keys, we check top-level key existence
            if (pkPathParts.length === 1) {
                const pk = pkPathParts[0];
                if (!obj.hasOwnProperty(pk) || obj[pk] === null) {
                    setEditorError(true, `Document must contain the partition key attribute: '${pk}'`);
                    return false;
                }
            }
        }
        
        setEditorError(false);
        return true;
    } catch (err) {
        setEditorError(true, "JSON Syntax Error: " + err.message);
        return false;
    }
}

function setEditorError(hasError, message = "") {
    if (hasError) {
        errorMessage.textContent = message;
        errorBanner.classList.add('active');
        btnSave.disabled = true;
        btnSave.style.opacity = '0.5';
        btnSave.style.cursor = 'not-allowed';
    } else {
        errorBanner.classList.remove('active');
        btnSave.disabled = false;
        btnSave.style.opacity = '';
        btnSave.style.cursor = '';
    }
}

function formatEditorJson() {
    const val = textarea.value.trim();
    if (!val) return;
    try {
        const obj = JSON.parse(val);
        textarea.value = JSON.stringify(obj, null, 2);
        validateJsonOnInput();
    } catch (err) {
        setEditorError(true, "Format failed! JSON Syntax Error: " + err.message);
    }
}

function openCreateModal() {
    activeEditMode = "create";
    document.getElementById('modalTitle').textContent = "Create New Document";
    if (textarea) textarea.readOnly = false;
    
    // Create template skeleton
    const skeleton = {
        id: "new-doc-id"
    };
    
    // Inject the partition key attribute if configured
    if (CONFIG && CONFIG.cleanPk) {
        const pkParts = CONFIG.cleanPk.split('/');
        if (pkParts.length === 1 && pkParts[0] !== 'id') {
            skeleton[pkParts[0]] = "default-value";
        }
    }
    
    textarea.value = JSON.stringify(skeleton, null, 2);
    setEditorError(false);
    openModal('documentModal');
}

function openEditModal(rawItem) {
    activeEditMode = "edit";
    const isReader = typeof CONFIG !== 'undefined' && CONFIG.isReader;
    document.getElementById('modalTitle').textContent = (isReader ? "View Document: " : "Edit Document: ") + (rawItem.id || "");
    if (textarea) textarea.readOnly = isReader;
    textarea.value = JSON.stringify(rawItem, null, 2);
    setEditorError(false);
    openModal('documentModal');
}

// --- 7. Save Document (Create/Update AJAX) ---
function saveDocument() {
    if (!validateJsonOnInput()) return;
    
    const bodyText = textarea.value.trim();
    const data = JSON.parse(bodyText);
    
    const url = `/cosmos-ui/api/db/${CONFIG.dbId}/container/${CONFIG.containerId}/item`;
    
    // Disable save button to prevent double-submit
    btnSave.disabled = true;
    btnSave.querySelector('span').textContent = "Saving...";
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if (res.status === 'success') {
            closeModal('documentModal');
            // Refresh container to display saved item
            window.location.reload();
        } else {
            setEditorError(true, res.message || "Failed to save document.");
            btnSave.disabled = false;
            btnSave.querySelector('span').textContent = "Save Document";
        }
    })
    .catch(err => {
        console.error(err);
        setEditorError(true, "Network connection error: " + err.message);
        btnSave.disabled = false;
        btnSave.querySelector('span').textContent = "Save Document";
    });
}

// --- 8. Confirm Delete Flow ---
function confirmDelete(id, pkVal) {
    activeDeleteItem = { id: id, partitionKey: pkVal };
    document.getElementById('deleteItemIdDisplay').textContent = id;
    openModal('deleteModal');
}

function executeDelete() {
    const btnConfirm = document.getElementById('btnConfirmDelete');
    btnConfirm.disabled = true;
    btnConfirm.querySelector('span').textContent = "Deleting...";

    const url = `/cosmos-ui/api/db/${CONFIG.dbId}/container/${CONFIG.containerId}/item/delete`;

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id: activeDeleteItem.id,
            partition_key: activeDeleteItem.partitionKey
        })
    })
    .then(res => res.json())
    .then(res => {
        if (res.status === 'success') {
            closeModal('deleteModal');
            window.location.reload();
        } else {
            alert("Error: " + res.message);
            btnConfirm.disabled = false;
            btnConfirm.querySelector('span').textContent = "Delete";
        }
    })
    .catch(err => {
        console.error(err);
        alert("Delete failed due to network error.");
        btnConfirm.disabled = false;
        btnConfirm.querySelector('span').textContent = "Delete";
    });
}

// --- 9. Theme Management Logic ---
function initTheme() {
    const storedTheme = localStorage.getItem("theme") || "dark";
    if (storedTheme === "light") {
        document.body.classList.add("light-theme");
        updateThemeToggleButton(true);
    } else {
        document.body.classList.remove("light-theme");
        updateThemeToggleButton(false);
    }
}

function toggleTheme() {
    const isCurrentlyLight = document.body.classList.contains("light-theme");
    if (isCurrentlyLight) {
        document.body.classList.remove("light-theme");
        localStorage.setItem("theme", "dark");
        updateThemeToggleButton(false);
    } else {
        document.body.classList.add("light-theme");
        localStorage.setItem("theme", "light");
        updateThemeToggleButton(true);
    }
}

function updateThemeToggleButton(isLight) {
    const toggleBtns = document.querySelectorAll("#themeToggle");
    toggleBtns.forEach(btn => {
        const icon = btn.querySelector("i");
        if (icon) {
            if (isLight) {
                icon.className = "fa-solid fa-sun";
            } else {
                icon.className = "fa-solid fa-moon";
            }
        }
    });
}

// Initialize theme immediately on script execute or DOMContentLoaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
} else {
    initTheme();
}

/// --- 10. Database and Container Provisioning ---
function toggleDbSource(source) {
    const selectWrapper = document.getElementById("db_select_wrapper");
    const inputWrapper = document.getElementById("db_input_wrapper");
    const dbInput = document.getElementById("create_db_id");
    
    if (source === "existing") {
        if (selectWrapper) selectWrapper.style.display = "block";
        if (inputWrapper) inputWrapper.style.display = "none";
        if (dbInput) dbInput.removeAttribute("required");
    } else {
        if (selectWrapper) selectWrapper.style.display = "none";
        if (inputWrapper) inputWrapper.style.display = "block";
        if (dbInput) dbInput.setAttribute("required", "true");
    }
}

function toggleModalDbSource(source) {
    const selectWrapper = document.getElementById("modal_db_select_wrapper");
    const inputWrapper = document.getElementById("modal_db_input_wrapper");
    const dbInput = document.getElementById("modal_db_id");
    
    if (source === "existing") {
        if (selectWrapper) selectWrapper.style.display = "block";
        if (inputWrapper) inputWrapper.style.display = "none";
        if (dbInput) dbInput.removeAttribute("required");
    } else {
        if (selectWrapper) selectWrapper.style.display = "none";
        if (inputWrapper) inputWrapper.style.display = "block";
        if (dbInput) dbInput.setAttribute("required", "true");
    }
}

function handleSingleCreate(e) {
    e.preventDefault();
    let dbId = "";
    const dbSourceRadio = document.querySelector("input[name='db_source']:checked");
    const dbSource = dbSourceRadio ? dbSourceRadio.value : "new";
    
    if (dbSource === "existing") {
        const selectEl = document.getElementById("create_db_select");
        dbId = selectEl ? selectEl.value : "";
    } else {
        const inputEl = document.getElementById("create_db_id");
        dbId = inputEl ? inputEl.value.trim() : "";
    }
    
    const containerEl = document.getElementById("create_container_id");
    const containerId = containerEl ? containerEl.value.trim() : "";
    const pkEl = document.getElementById("create_partition_key");
    const partitionKey = pkEl ? pkEl.value.trim() : "";
    
    submitProvisionRequest(dbId, containerId, partitionKey, "singleCreateForm");
}

function handleGlobalCreate(e) {
    e.preventDefault();
    let dbId = "";
    const dbSourceRadio = document.querySelector("input[name='modal_db_source']:checked");
    const dbSource = dbSourceRadio ? dbSourceRadio.value : "new";
    
    if (dbSource === "existing") {
        const selectEl = document.getElementById("modal_db_select");
        dbId = selectEl ? selectEl.value : "";
    } else {
        const inputEl = document.getElementById("modal_db_id");
        dbId = inputEl ? inputEl.value.trim() : "";
    }
    
    const containerEl = document.getElementById("modal_container_id");
    const containerId = containerEl ? containerEl.value.trim() : "";
    const pkEl = document.getElementById("modal_partition_key");
    const partitionKey = pkEl ? pkEl.value.trim() : "";
    
    submitProvisionRequest(dbId, containerId, partitionKey, "globalCreateModal");
}

function submitProvisionRequest(dbId, containerId, partitionKey, sourceElementId) {
    let submitBtn = null;
    if (sourceElementId === "singleCreateForm") {
        submitBtn = document.querySelector("#singleCreateForm button[type='submit']");
    } else {
        submitBtn = document.getElementById("btnGlobalCreate");
    }
    
    const originalBtnText = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> <span>Provisioning...</span>";
    }
    
    fetch("/cosmos-ui/api/provision", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            db_id: dbId,
            container_id: containerId,
            partition_key: partitionKey
        })
    })
    .then(res => res.json())
    .then(res => {
        if (res.status === "success") {
            if (sourceElementId === "globalCreateModal") {
                closeModal("globalCreateModal");
            }
            alert(res.message);
            window.location.reload();
        } else {
            alert("Error provisioning resources: " + res.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    })
    .catch(err => {
        console.error(err);
        alert("Provisioning failed due to network error.");
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
}

function openCreateStructureModal() {
    // Reset global modal inputs
    const dbField = document.getElementById("modal_db_id");
    const containerField = document.getElementById("modal_container_id");
    const pkField = document.getElementById("modal_partition_key");
    if (dbField) dbField.value = "";
    if (containerField) containerField.value = "";
    if (pkField) pkField.value = "/id";
    
    // Default modal source to existing if we have options, otherwise new
    const existingRadio = document.querySelector("input[name='modal_db_source'][value='existing']");
    if (existingRadio) {
        existingRadio.checked = true;
        toggleModalDbSource("existing");
    } else {
        const newRadio = document.querySelector("input[name='modal_db_source'][value='new']");
        if (newRadio) newRadio.checked = true;
        toggleModalDbSource("new");
    }
    
    openModal("globalCreateModal");
}

function updateBulkFileNameDisplay(input) {
    const display = document.getElementById('bulkCreateFileName');
    if (display) {
        if (input.files && input.files.length > 0) {
            display.textContent = input.files[0].name;
            display.style.color = 'var(--text-white)';
            display.style.fontWeight = '500';
        } else {
            display.textContent = "Choose CSV or Excel file";
            display.style.color = '';
            display.style.fontWeight = '';
        }
    }
}

// --- 11. Secure Database Deletion ---
let activeDeleteDbId = null;

function confirmDeleteDb(dbId) {
    activeDeleteDbId = dbId;
    document.getElementById("deleteDbNameDisplay").textContent = dbId;
    document.getElementById("delete_db_confirm_input").value = "";
    document.getElementById("deleteDbError").style.display = "none";
    openModal("deleteDbModal");
}

function executeDeleteDb(e) {
    e.preventDefault();
    const confirmInput = document.getElementById("delete_db_confirm_input").value.trim();
    const errorBanner = document.getElementById("deleteDbError");
    
    if (confirmInput !== activeDeleteDbId) {
        errorBanner.style.display = "block";
        errorBanner.textContent = `Database ID does not match. Expected: ${activeDeleteDbId}`;
        return;
    }
    
    errorBanner.style.display = "none";
    const btnConfirm = document.getElementById("btnConfirmDeleteDb");
    btnConfirm.disabled = true;
    btnConfirm.querySelector("span").textContent = "Deleting...";
    
    fetch(`/cosmos-ui/api/db/${activeDeleteDbId}/delete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(res => res.json())
    .then(res => {
        if (res.status === "success") {
            closeModal("deleteDbModal");
            alert(res.message);
            window.location.href = "/cosmos-ui/dashboard";
        } else {
            alert("Error deleting database: " + res.message);
            btnConfirm.disabled = false;
            btnConfirm.querySelector("span").textContent = "Delete Database";
        }
    })
    .catch(err => {
        console.error(err);
        alert("Database deletion failed due to network error.");
        btnConfirm.disabled = false;
        btnConfirm.querySelector("span").textContent = "Delete Database";
    });
}

// --- 12. Secure Container Deletion ---
let activeDeleteContainerDbId = null;
let activeDeleteContainerId = null;

function confirmDeleteContainer(dbId, containerId) {
    activeDeleteContainerDbId = dbId;
    activeDeleteContainerId = containerId;
    document.getElementById("deleteContainerNameDisplay").textContent = containerId;
    document.getElementById("delete_container_confirm_input").value = "";
    document.getElementById("deleteContainerError").style.display = "none";
    openModal("deleteContainerModal");
}

function executeDeleteContainer(e) {
    e.preventDefault();
    const confirmInput = document.getElementById("delete_container_confirm_input").value.trim();
    const errorBanner = document.getElementById("deleteContainerError");
    
    if (confirmInput !== activeDeleteContainerId) {
        errorBanner.style.display = "block";
        errorBanner.textContent = `Container ID does not match. Expected: ${activeDeleteContainerId}`;
        return;
    }
    
    errorBanner.style.display = "none";
    const btnConfirm = document.getElementById("btnConfirmDeleteContainer");
    btnConfirm.disabled = true;
    btnConfirm.querySelector("span").textContent = "Deleting...";
    
    fetch(`/cosmos-ui/api/db/${activeDeleteContainerDbId}/container/${activeDeleteContainerId}/delete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(res => res.json())
    .then(res => {
        if (res.status === "success") {
            closeModal("deleteContainerModal");
            alert(res.message);
            
            // Redirect to dashboard if we deleted the container we were currently viewing
            if (typeof CONFIG !== "undefined" && CONFIG.dbId === activeDeleteContainerDbId && CONFIG.containerId === activeDeleteContainerId) {
                window.location.href = "/cosmos-ui/dashboard";
            } else {
                window.location.reload();
            }
        } else {
            alert("Error deleting container: " + res.message);
            btnConfirm.disabled = false;
            btnConfirm.querySelector("span").textContent = "Delete Container";
        }
    })
    .catch(err => {
        console.error(err);
        alert("Container deletion failed due to network error.");
        btnConfirm.disabled = false;
        btnConfirm.querySelector("span").textContent = "Delete Container";
    });
}

// --- 13. Bulk Create Flow ---
document.addEventListener("DOMContentLoaded", () => {
    const bulkForm = document.getElementById("bulkCreateForm");
    if (bulkForm) {
        bulkForm.addEventListener("submit", function(e) {
            e.preventDefault();
            
            const formData = new FormData(bulkForm);
            
            // Show loading state on button
            const btn = bulkForm.querySelector('button[type="submit"]');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Checking...</span>';

            fetch("/cosmos-ui/api/bulk-check", {
                method: "POST",
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                
                if (data.status === "success") {
                    if (data.existing_dbs && data.existing_dbs.length > 0) {
                        const list = document.getElementById("bulkExistingDbsList");
                        if (list) {
                            list.innerHTML = "";
                            data.existing_dbs.forEach(db => {
                                const li = document.createElement("li");
                                li.textContent = db;
                                list.appendChild(li);
                            });
                        }
                        openModal("bulkConfirmModal");
                    } else {
                        // No existing DBs, submit immediately
                        submitBulkCreate("merge"); 
                    }
                } else {
                    alert("Error checking file: " + data.message);
                }
            })
            .catch(err => {
                console.error(err);
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                alert("Network error checking bulk upload.");
            });
        });
    }
});

function closeBulkConfirmModal() {
    closeModal("bulkConfirmModal");
}

function submitBulkCreate(mode) {
    const bulkForm = document.getElementById("bulkCreateForm");
    if (!bulkForm) return;
    
    // Remove existing mode input if any
    let existingModeInput = bulkForm.querySelector('input[name="mode"]');
    if (existingModeInput) {
        existingModeInput.remove();
    }
    
    // Add mode input
    const modeInput = document.createElement("input");
    modeInput.type = "hidden";
    modeInput.name = "mode";
    modeInput.value = mode;
    bulkForm.appendChild(modeInput);
    
    // Disable button to show loading
    const btn = bulkForm.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Uploading...</span>';
    }
    
    closeBulkConfirmModal();
    
    // Submit natively
    bulkForm.submit();
}

// =========================================================================
// --- 16. Document Checkbox Multi-Selection & Bulk Deletion Logic ---
// =========================================================================
let selectedDocuments = [];

function toggleSelectAllDocs(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.doc-select-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = masterCheckbox.checked;
        const row = cb.closest('tr');
        if (row) {
            if (masterCheckbox.checked) {
                row.classList.add('selected-row');
            } else {
                row.classList.remove('selected-row');
            }
        }
    });
    updateDocSelection();
}

function updateDocSelection() {
    const checkedBoxes = document.querySelectorAll('.doc-select-checkbox:checked');
    selectedDocuments = [];
    
    checkedBoxes.forEach(cb => {
        const id = cb.getAttribute('data-id');
        let pk = cb.getAttribute('data-pk');
        try {
            pk = JSON.parse(pk);
        } catch(e) {}
        if (id) {
            selectedDocuments.push({ id: id, partition_key: pk });
        }
        const row = cb.closest('tr');
        if (row) row.classList.add('selected-row');
    });

    document.querySelectorAll('.doc-select-checkbox:not(:checked)').forEach(cb => {
        const row = cb.closest('tr');
        if (row) row.classList.remove('selected-row');
    });

    const allCheckboxes = document.querySelectorAll('.doc-select-checkbox');
    const masterCheckbox = document.getElementById('selectAllDocs');
    if (masterCheckbox && allCheckboxes.length > 0) {
        masterCheckbox.checked = (checkedBoxes.length === allCheckboxes.length);
        masterCheckbox.indeterminate = (checkedBoxes.length > 0 && checkedBoxes.length < allCheckboxes.length);
    }

    const toolbar = document.getElementById('bulkActionsToolbar');
    const badge = document.getElementById('selectedCountBadge');
    if (toolbar) {
        if (selectedDocuments.length > 0) {
            toolbar.style.display = 'inline-flex';
            if (badge) badge.textContent = `${selectedDocuments.length} selected`;
        } else {
            toolbar.style.display = 'none';
        }
    }
}

function deselectAllDocs() {
    const master = document.getElementById('selectAllDocs');
    if (master) {
        master.checked = false;
        master.indeterminate = false;
    }
    document.querySelectorAll('.doc-select-checkbox').forEach(cb => {
        cb.checked = false;
        const row = cb.closest('tr');
        if (row) row.classList.remove('selected-row');
    });
    updateDocSelection();
}

function openBulkDeleteModal() {
    if (!selectedDocuments || selectedDocuments.length === 0) return;
    const countDisplay = document.getElementById('bulkDeleteCountDisplay');
    if (countDisplay) countDisplay.textContent = selectedDocuments.length;
    
    const list = document.getElementById('bulkDeleteIdList');
    if (list) {
        list.innerHTML = selectedDocuments.slice(0, 15).map(item => `<li>${item.id}</li>`).join('');
        if (selectedDocuments.length > 15) {
            list.innerHTML += `<li>...and ${selectedDocuments.length - 15} more</li>`;
        }
    }
    openModal('bulkDeleteModal');
}

function executeBulkDelete() {
    if (!selectedDocuments || selectedDocuments.length === 0) return;
    const btn = document.getElementById('btnConfirmBulkDelete');
    btn.disabled = true;
    btn.querySelector('span').textContent = "Deleting selected...";

    const url = `/cosmos-ui/api/db/${CONFIG.dbId}/container/${CONFIG.containerId}/items/bulk-delete`;

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedDocuments })
    })
    .then(res => res.json())
    .then(res => {
        if (res.status === 'success') {
            closeModal('bulkDeleteModal');
            alert(res.message);
            window.location.reload();
        } else {
            alert("Bulk Delete Error: " + (res.message || "Failed"));
            btn.disabled = false;
            btn.querySelector('span').textContent = "Confirm Bulk Delete";
        }
    })
    .catch(err => {
        console.error(err);
        alert("Network error occurred during bulk delete.");
        btn.disabled = false;
        btn.querySelector('span').textContent = "Confirm Bulk Delete";
    });
}

// =========================================================================
// --- 17. High-Throughput Bulk Import & Live Progress Tracking ---
// =========================================================================
let activeImportTaskId = null;
let importPollInterval = null;

function handleAsyncImportSubmit(event) {
    event.preventDefault();
    const form = document.getElementById('asyncImportForm');
    const fileInput = document.getElementById('importFile');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Please choose a file to import.");
        return;
    }

    const formData = new FormData(form);
    const btn = document.getElementById('btnStartImport');
    btn.disabled = true;
    btn.querySelector('span').textContent = "Initiating...";

    const url = `/cosmos-ui/api/db/${CONFIG.dbId}/container/${CONFIG.containerId}/import-async`;

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(res => {
        btn.disabled = false;
        btn.querySelector('span').textContent = "Start High-Speed Import";
        if (res.status === 'success') {
            closeModal('importModal');
            activeImportTaskId = res.task_id;
            openImportProgressModal(res.total_estimate);
            startImportProgressPolling();
        } else {
            alert("Error starting import: " + (res.message || "Unknown error"));
        }
    })
    .catch(err => {
        console.error(err);
        btn.disabled = false;
        btn.querySelector('span').textContent = "Start High-Speed Import";
        alert("Network error uploading file: " + err.message);
    });
}

function openImportProgressModal(totalEstimate) {
    document.getElementById('importProgressTitle').textContent = "Importing Documents...";
    document.getElementById('importProgressStatusText').textContent = "Streaming & ingesting records...";
    document.getElementById('importPercentDisplay').textContent = "0%";
    document.getElementById('importProgressBarFill').style.width = "0%";
    document.getElementById('metricProcessed').textContent = "0";
    document.getElementById('metricSuccess').textContent = "0";
    document.getElementById('metricSpeed').textContent = "0 docs/s";
    document.getElementById('metricRetries').textContent = "0";
    document.getElementById('importErrorPreviewBox').style.display = "none";
    document.getElementById('btnCancelImport').style.display = "inline-flex";
    document.getElementById('btnCloseProgressModal').style.display = "none";
    document.getElementById('importSpinnerIcon').className = "fa-solid fa-spinner fa-spin title-icon";
    openModal('importProgressModal');
}

function startImportProgressPolling() {
    if (importPollInterval) clearInterval(importPollInterval);
    importPollInterval = setInterval(pollImportProgress, 600);
}

function pollImportProgress() {
    if (!activeImportTaskId) return;

    fetch(`/cosmos-ui/api/import-task/${activeImportTaskId}`)
    .then(res => res.json())
    .then(res => {
        if (res.status === 'success') {
            const task = res.task;
            updateImportProgressUI(task);
        }
    })
    .catch(err => console.error("Poll error:", err));
}

function updateImportProgressUI(task) {
    const status = task.status;
    const processed = task.processed || 0;
    const success = task.successful || 0;
    const speed = task.speed_per_sec || 0;
    const retries = task.retries_429 || 0;
    const errors = task.errors || [];
    const totalEst = task.total_estimate || 0;

    document.getElementById('metricProcessed').textContent = processed.toLocaleString();
    document.getElementById('metricSuccess').textContent = success.toLocaleString();
    document.getElementById('metricSpeed').textContent = `${speed.toLocaleString()} docs/s`;
    document.getElementById('metricRetries').textContent = retries.toLocaleString();

    // Progress percentage
    let percent = 0;
    if (totalEst > 0) {
        percent = Math.min(100, Math.round((processed / totalEst) * 100));
    } else if (status === 'completed') {
        percent = 100;
    }
    document.getElementById('importPercentDisplay').textContent = `${percent}%`;
    document.getElementById('importProgressBarFill').style.width = `${percent}%`;

    // Error preview
    if (errors.length > 0) {
        const errBox = document.getElementById('importErrorPreviewBox');
        const errList = document.getElementById('importErrorList');
        errBox.style.display = 'block';
        errList.innerHTML = errors.map(e => `<div>• ${e}</div>`).join('');
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        clearInterval(importPollInterval);
        importPollInterval = null;
        document.getElementById('btnCancelImport').style.display = "none";
        document.getElementById('btnCloseProgressModal').style.display = "inline-flex";

        if (status === 'completed') {
            document.getElementById('importSpinnerIcon').className = "fa-solid fa-circle-check title-icon text-success";
            document.getElementById('importProgressTitle').textContent = "Import Completed!";
            document.getElementById('importProgressStatusText').textContent = `Finished: ${success.toLocaleString()} documents ingested in ${task.elapsed_seconds}s`;
            document.getElementById('importPercentDisplay').textContent = "100%";
            document.getElementById('importProgressBarFill').style.width = "100%";
        } else if (status === 'cancelled') {
            document.getElementById('importSpinnerIcon').className = "fa-solid fa-circle-stop title-icon text-warning";
            document.getElementById('importProgressTitle').textContent = "Import Cancelled";
            document.getElementById('importProgressStatusText').textContent = `Stopped by user after ${processed.toLocaleString()} records.`;
        } else {
            document.getElementById('importSpinnerIcon').className = "fa-solid fa-circle-exclamation title-icon text-danger";
            document.getElementById('importProgressTitle').textContent = "Import Failed";
            document.getElementById('importProgressStatusText').textContent = task.error_message || "Encountered an error.";
        }
    }
}

function cancelActiveImport() {
    if (!activeImportTaskId) return;
    if (!confirm("Are you sure you want to cancel the active bulk import job?")) return;

    const cancelBtn = document.getElementById('btnCancelImport');
    if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelling...';
    }
    document.getElementById('importProgressStatusText').textContent = "Cancelling import job...";

    fetch(`/cosmos-ui/api/import-task/${activeImportTaskId}/cancel`, { method: 'POST' })
    .then(res => res.json())
    .then(res => {
        if (importPollInterval) {
            clearInterval(importPollInterval);
            importPollInterval = null;
        }
        document.getElementById('importSpinnerIcon').className = "fa-solid fa-circle-stop title-icon text-warning";
        document.getElementById('importProgressTitle').textContent = "Import Cancelled";
        document.getElementById('importProgressStatusText').textContent = "Stopped by user.";
        if (cancelBtn) cancelBtn.style.display = "none";
        document.getElementById('btnCloseProgressModal').style.display = "inline-flex";
    })
    .catch(err => {
        console.error("Cancel error:", err);
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Cancel Import';
        }
    });
}

function closeImportProgressModal() {
    if (importPollInterval) {
        clearInterval(importPollInterval);
        importPollInterval = null;
    }
    closeModal('importProgressModal');
    window.location.reload();
}

// =========================================================================
// --- 18. Inspect Raw JSON (for Custom Projections) ---
// =========================================================================
function inspectRawJson(obj) {
    const pre = document.getElementById('rawJsonDisplay');
    if (pre) {
        pre.textContent = JSON.stringify(obj, null, 2);
    }
    openModal('rawJsonModal');
}

// =========================================================================
// --- 19. Empty Container (Delete All Documents) Logic ---
// =========================================================================
function openEmptyContainerModal() {
    openModal('emptyContainerModal');
}

function executeEmptyContainer() {
    const btn = document.getElementById('btnConfirmEmptyContainer');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Emptying container...</span>';

    const url = `/cosmos-ui/api/db/${CONFIG.dbId}/container/${CONFIG.containerId}/empty`;

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(res => {
        if (res.status === 'success') {
            closeModal('emptyContainerModal');
            alert(res.message);
            window.location.reload();
        } else {
            alert("Error emptying container: " + (res.message || "Failed"));
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-broom"></i><span>Yes, Empty Container</span>';
        }
    })
    .catch(err => {
        console.error(err);
        alert("Network error emptying container.");
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-broom"></i><span>Yes, Empty Container</span>';
    });
}

// =========================================================================
// --- 20. High-Speed Streaming Export & Live Progress Logic ---
// =========================================================================
let activeExportTaskId = null;
let exportPollInterval = null;

function openExportModal() {
    openModal('exportModal');
}

function handleAsyncExportSubmit(event) {
    event.preventDefault();
    const formatSelect = document.getElementById('exportFormatSelect');
    const format = formatSelect ? formatSelect.value : 'jsonl';

    const urlParams = new URLSearchParams(window.location.search);
    const searchMode = urlParams.get('search_mode') || 'simple';
    const searchQuery = urlParams.get('search_query') || '';

    const btn = document.getElementById('btnStartExport');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Initiating Export...</span>';

    const url = `/cosmos-ui/api/db/${CONFIG.dbId}/container/${CONFIG.containerId}/export-async`;

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            format: format,
            search_mode: searchMode,
            search_query: searchQuery,
            total_estimate: (CONFIG && CONFIG.totalItems) ? CONFIG.totalItems : 0
        })
    })
    .then(res => res.json())
    .then(res => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-bolt"></i><span>Start High-Speed Export</span>';
        if (res.status === 'success') {
            closeModal('exportModal');
            activeExportTaskId = res.task_id;
            openExportProgressModal((CONFIG && CONFIG.totalItems) ? CONFIG.totalItems : 0);
            startExportProgressPolling();
        } else {
            alert("Error starting export: " + (res.message || "Unknown error"));
        }
    })
    .catch(err => {
        console.error(err);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-bolt"></i><span>Start High-Speed Export</span>';
        alert("Network error starting export: " + err.message);
    });
}

function openExportProgressModal(totalEstimate) {
    document.getElementById('exportProgressTitle').textContent = "Exporting Documents...";
    document.getElementById('exportProgressStatusText').textContent = "Streaming records from Cosmos DB...";
    document.getElementById('exportPercentDisplay').textContent = "0%";
    document.getElementById('exportProgressBarFill').style.width = "0%";
    document.getElementById('metricExported').textContent = "0";
    document.getElementById('metricExportSpeed').textContent = "0 docs/s";
    document.getElementById('metricExportRetries').textContent = "0";
    document.getElementById('metricExportElapsed').textContent = "0s";
    document.getElementById('btnCancelExport').style.display = "inline-flex";
    document.getElementById('btnDownloadExportResult').style.display = "none";
    document.getElementById('exportSpinnerIcon').className = "fa-solid fa-spinner fa-spin title-icon";
    openModal('exportProgressModal');
}

function startExportProgressPolling() {
    if (exportPollInterval) clearInterval(exportPollInterval);
    exportPollInterval = setInterval(pollExportProgress, 600);
}

function pollExportProgress() {
    if (!activeExportTaskId) return;

    fetch(`/cosmos-ui/api/export-task/${activeExportTaskId}`)
    .then(res => res.json())
    .then(res => {
        if (res.status === 'success') {
            const task = res.task;
            updateExportProgressUI(task);
        }
    })
    .catch(err => console.error("Export poll error:", err));
}

function updateExportProgressUI(task) {
    const status = task.status;
    const processed = task.processed || 0;
    const speed = task.speed_per_sec || 0;
    const retries = task.retries_429 || 0;
    const elapsed = task.elapsed_seconds || 0;
    const totalEst = task.total_estimate || 0;

    document.getElementById('metricExported').textContent = processed.toLocaleString();
    document.getElementById('metricExportSpeed').textContent = `${speed.toLocaleString()} docs/s`;
    document.getElementById('metricExportRetries').textContent = retries.toLocaleString();
    document.getElementById('metricExportElapsed').textContent = `${elapsed}s`;

    let percent = 0;
    if (totalEst > 0) {
        percent = Math.min(100, Math.round((processed / totalEst) * 100));
    } else if (status === 'completed') {
        percent = 100;
    }
    document.getElementById('exportPercentDisplay').textContent = `${percent}%`;
    document.getElementById('exportProgressBarFill').style.width = `${percent}%`;

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        if (exportPollInterval) {
            clearInterval(exportPollInterval);
            exportPollInterval = null;
        }
        document.getElementById('btnCancelExport').style.display = "none";
        const downloadBtn = document.getElementById('btnDownloadExportResult');

        if (status === 'completed') {
            document.getElementById('exportSpinnerIcon').className = "fa-solid fa-circle-check title-icon text-success";
            document.getElementById('exportProgressTitle').textContent = "Export Ready!";
            document.getElementById('exportProgressStatusText').textContent = `Successfully streamed ${processed.toLocaleString()} records in ${elapsed}s.`;
            document.getElementById('exportPercentDisplay').textContent = "100%";
            document.getElementById('exportProgressBarFill').style.width = "100%";
            if (downloadBtn) downloadBtn.style.display = "inline-flex";

            // Automatically trigger download
            window.location.href = `/cosmos-ui/api/export-task/${activeExportTaskId}/download`;
        } else if (status === 'cancelled') {
            document.getElementById('exportSpinnerIcon').className = "fa-solid fa-circle-stop title-icon text-warning";
            document.getElementById('exportProgressTitle').textContent = "Export Cancelled";
            document.getElementById('exportProgressStatusText').textContent = `Export stopped by user after ${processed.toLocaleString()} records.`;
        } else {
            document.getElementById('exportSpinnerIcon').className = "fa-solid fa-circle-exclamation title-icon text-danger";
            document.getElementById('exportProgressTitle').textContent = "Export Failed";
            document.getElementById('exportProgressStatusText').textContent = task.error_message || "Encountered an export error.";
        }
    }
}

function cancelActiveExport() {
    if (!activeExportTaskId) return;
    if (!confirm("Are you sure you want to cancel the active export job?")) return;

    const cancelBtn = document.getElementById('btnCancelExport');
    if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelling...';
    }
    document.getElementById('exportProgressStatusText').textContent = "Cancelling export job...";

    fetch(`/cosmos-ui/api/export-task/${activeExportTaskId}/cancel`, { method: 'POST' })
    .then(res => res.json())
    .then(() => {
        if (exportPollInterval) {
            clearInterval(exportPollInterval);
            exportPollInterval = null;
        }
        document.getElementById('exportSpinnerIcon').className = "fa-solid fa-circle-stop title-icon text-warning";
        document.getElementById('exportProgressTitle').textContent = "Export Cancelled";
        document.getElementById('exportProgressStatusText').textContent = "Stopped by user.";
        if (cancelBtn) cancelBtn.style.display = "none";
    })
    .catch(err => console.error("Export cancel error:", err));
}

function downloadAndCloseExportModal() {
    if (activeExportTaskId) {
        window.location.href = `/cosmos-ui/api/export-task/${activeExportTaskId}/download`;
    }
    closeModal('exportProgressModal');
}

// =========================================================================
// --- 21. Change Password Modal Helpers ---
// =========================================================================
function openChangePasswordModal() {
    const cur = document.getElementById("current_password");
    const np = document.getElementById("new_password");
    const cp = document.getElementById("confirm_password");
    const err = document.getElementById("changePasswordError");
    if (cur) cur.value = "";
    if (np) np.value = "";
    if (cp) cp.value = "";
    if (err) {
        err.style.display = "none";
        err.textContent = "";
    }
    openModal("changePasswordModal");
}

function validateChangePassword(e) {
    const np = document.getElementById("new_password").value;
    const cp = document.getElementById("confirm_password").value;
    const err = document.getElementById("changePasswordError");
    
    if (np.length < 6) {
        if (err) {
            err.textContent = "New password must be at least 6 characters long.";
            err.style.display = "block";
        }
        e.preventDefault();
        return false;
    }
    if (np !== cp) {
        if (err) {
            err.textContent = "New password and confirmation do not match.";
            err.style.display = "block";
        }
        e.preventDefault();
        return false;
    }
    return true;
}
