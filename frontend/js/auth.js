/**
 * CogniVault - Authentication Module
 * Handles login and registration form validation, submission, and UI state.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we're on
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) initLogin();
    if (registerForm) initRegister();

    // Setup all password toggles on the page
    setupPasswordToggles();
});

/* ── Login Page ── */

/**
 * Initialize the login page logic.
 */
function initLogin() {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');
    const successDiv = document.getElementById('login-success');

    // Check for ?registered=1 query param to show success banner
    const params = new URLSearchParams(window.location.search);
    if (params.get('registered') === '1' && successDiv) {
        successDiv.style.display = 'flex';
    }

    // If already logged in, redirect to dashboard
    if (CogniAPI.getToken()) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Validate on blur
    emailInput.addEventListener('blur', () => validateEmail(emailInput, 'login-email-error'));
    passwordInput.addEventListener('blur', () => validateRequired(passwordInput, 'login-password-error'));

    // Clear errors on input
    emailInput.addEventListener('input', () => clearFieldError(emailInput, 'login-email-error'));
    passwordInput.addEventListener('input', () => clearFieldError(passwordInput, 'login-password-error'));

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError(errorDiv);

        // Validate all fields
        const emailValid = validateEmail(emailInput, 'login-email-error');
        const passValid = validateRequired(passwordInput, 'login-password-error');

        if (!emailValid || !passValid) return;

        // Show loading state
        setButtonLoading(btn, true);

        try {
            const data = await CogniAPI.apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: emailInput.value.trim(),
                    password: passwordInput.value
                })
            });

            CogniAPI.storeAuth(data.access_token, data.user_id, data.name, emailInput.value.trim());
            window.location.href = 'dashboard.html';

        } catch (error) {
            showAuthError(errorDiv, 'login-error-text', error.message);
        } finally {
            setButtonLoading(btn, false);
        }
    });
}

/* ── Register Page ── */

/**
 * Initialize the registration page logic.
 */
function initRegister() {
    const form = document.getElementById('register-form');
    const nameInput = document.getElementById('reg-name');
    const emailInput = document.getElementById('reg-email');
    const passwordInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-confirm-password');
    const genderSelect = document.getElementById('reg-gender');
    const btn = document.getElementById('register-btn');
    const errorDiv = document.getElementById('reg-error');

    // If already logged in, redirect
    if (CogniAPI.getToken()) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Validate on blur
    nameInput.addEventListener('blur', () => validateName(nameInput, 'reg-name-error'));
    emailInput.addEventListener('blur', () => validateEmail(emailInput, 'reg-email-error'));
    passwordInput.addEventListener('blur', () => validatePassword(passwordInput, 'reg-password-error'));
    confirmInput.addEventListener('blur', () => validateConfirmPassword(passwordInput, confirmInput, 'reg-confirm-error'));

    // Clear errors on input
    nameInput.addEventListener('input', () => clearFieldError(nameInput, 'reg-name-error'));
    emailInput.addEventListener('input', () => clearFieldError(emailInput, 'reg-email-error'));
    passwordInput.addEventListener('input', () => {
        clearFieldError(passwordInput, 'reg-password-error');
        updatePasswordStrength(passwordInput.value);
    });
    confirmInput.addEventListener('input', () => clearFieldError(confirmInput, 'reg-confirm-error'));

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError(errorDiv);

        // Validate all fields
        const nameValid = validateName(nameInput, 'reg-name-error');
        const emailValid = validateEmail(emailInput, 'reg-email-error');
        const passValid = validatePassword(passwordInput, 'reg-password-error');
        const confirmValid = validateConfirmPassword(passwordInput, confirmInput, 'reg-confirm-error');

        if (!nameValid || !emailValid || !passValid || !confirmValid) return;

        setButtonLoading(btn, true);

        try {
            const body = {
                name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                password: passwordInput.value
            };

            const gender = genderSelect.value;
            if (gender) body.gender = gender;

            await CogniAPI.apiRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify(body)
            });

            window.location.href = 'login.html?registered=1';

        } catch (error) {
            showAuthError(errorDiv, 'reg-error-text', error.message);
        } finally {
            setButtonLoading(btn, false);
        }
    });
}

/* ── Validation Functions ── */

/**
 * Validate that a field is not empty.
 * @param {HTMLInputElement} input - The input element.
 * @param {string} errorId - ID of the error span.
 * @returns {boolean} True if valid.
 */
function validateRequired(input, errorId) {
    const value = input.value.trim();
    if (!value) {
        showFieldError(input, errorId);
        return false;
    }
    clearFieldError(input, errorId);
    return true;
}

/**
 * Validate name field: 2-100 chars, no numbers.
 * @param {HTMLInputElement} input - The name input.
 * @param {string} errorId - ID of the error span.
 * @returns {boolean} True if valid.
 */
function validateName(input, errorId) {
    const value = input.value.trim();
    const nameRegex = /^[a-zA-Z\s'-]{2,100}$/;

    if (!value || !nameRegex.test(value)) {
        showFieldError(input, errorId);
        return false;
    }
    clearFieldError(input, errorId);
    return true;
}

/**
 * Validate email format.
 * @param {HTMLInputElement} input - The email input.
 * @param {string} errorId - ID of the error span.
 * @returns {boolean} True if valid.
 */
function validateEmail(input, errorId) {
    const value = input.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!value || !emailRegex.test(value)) {
        showFieldError(input, errorId);
        return false;
    }
    clearFieldError(input, errorId);
    return true;
}

/**
 * Validate password: min 8 chars, 1 uppercase, 1 digit.
 * @param {HTMLInputElement} input - The password input.
 * @param {string} errorId - ID of the error span.
 * @returns {boolean} True if valid.
 */
function validatePassword(input, errorId) {
    const value = input.value;
    const hasMinLength = value.length >= 8;
    const hasUppercase = /[A-Z]/.test(value);
    const hasDigit = /\d/.test(value);

    if (!hasMinLength || !hasUppercase || !hasDigit) {
        showFieldError(input, errorId);
        return false;
    }
    clearFieldError(input, errorId);
    return true;
}

/**
 * Validate confirm password matches password.
 * @param {HTMLInputElement} passwordInput - The password input.
 * @param {HTMLInputElement} confirmInput - The confirm password input.
 * @param {string} errorId - ID of the error span.
 * @returns {boolean} True if valid.
 */
function validateConfirmPassword(passwordInput, confirmInput, errorId) {
    if (!confirmInput.value || confirmInput.value !== passwordInput.value) {
        showFieldError(confirmInput, errorId);
        return false;
    }
    clearFieldError(confirmInput, errorId);
    return true;
}

/* ── Password Strength ── */

/**
 * Update the password strength indicator.
 * @param {string} password - Current password value.
 */
function updatePasswordStrength(password) {
    const indicator = document.getElementById('password-strength');
    if (!indicator) return;

    let strength = 0;
    if (password.length >= 4) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/\d/.test(password) && /[^a-zA-Z0-9]/.test(password)) strength++;

    indicator.setAttribute('data-strength', strength.toString());
}

/* ── Password Toggle ── */

/**
 * Setup show/hide password toggle buttons.
 */
function setupPasswordToggles() {
    const toggles = document.querySelectorAll('.input-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = toggle.parentElement.querySelector('input');
            const icon = toggle.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

/* ── UI Helpers ── */

/**
 * Show a field-level error.
 * @param {HTMLInputElement} input - The input element.
 * @param {string} errorId - ID of the error span.
 */
function showFieldError(input, errorId) {
    input.classList.add('error');
    const errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.classList.add('visible');
}

/**
 * Clear a field-level error.
 * @param {HTMLInputElement} input - The input element.
 * @param {string} errorId - ID of the error span.
 */
function clearFieldError(input, errorId) {
    input.classList.remove('error');
    const errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.classList.remove('visible');
}

/**
 * Show the auth-level error banner.
 * @param {HTMLElement} errorDiv - The error container.
 * @param {string} textId - ID of the error text span.
 * @param {string} message - Error message to display.
 */
function showAuthError(errorDiv, textId, message) {
    const textEl = document.getElementById(textId);
    if (textEl) textEl.textContent = message;
    if (errorDiv) errorDiv.classList.add('visible');
}

/**
 * Hide the auth-level error banner.
 * @param {HTMLElement} errorDiv - The error container.
 */
function hideError(errorDiv) {
    if (errorDiv) errorDiv.classList.remove('visible');
}

/**
 * Set button loading state.
 * @param {HTMLButtonElement} btn - The button element.
 * @param {boolean} loading - Whether to show loading state.
 */
function setButtonLoading(btn, loading) {
    if (loading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

/**
 * Simulate a network delay for mock mode.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
function simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
