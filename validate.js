// validate.js (CommonJS)
// Pure functions — no Express/network code — easy to unit test in isolation.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[A-Za-z][A-Za-z\s'-]*$/; // letters, spaces, apostrophes, hyphens only
const PHONE_RE = /^\d{10}$/; // exactly 10 digits, no country code/symbols

const LIMITS = {
  name: { min: 2, max: 80 },
  email: { min: 5, max: 254 },
  phone: { length: 10 },
  message: { min: 0, max: 1000 }, // optional field
};

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validates the KineticHQ enquiry payload: name, phone, email are required;
 * message is optional. The enquiry only "passes" (data is returned) when
 * name, phone and email all pass their individual checks.
 *
 * Returns { errors: string[], data: object|null, isBot: boolean }
 */
function validateEnquiryPayload(body) {
  const errors = [];

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be a JSON object."], data: null, isBot: false };
  }

  const { name, phone, email, message, company } = body;

  // Honeypot: a hidden field real users never fill in.
  const isBot = typeof company === "string" && company.trim().length > 0;

  // --- name: required, alphabet-only (spaces/hyphens/apostrophes allowed) ---
  if (!isNonEmptyString(name)) {
    errors.push("Name is required.");
  } else {
    const trimmed = name.trim();
    if (trimmed.length < LIMITS.name.min || trimmed.length > LIMITS.name.max) {
      errors.push(`Name must be between ${LIMITS.name.min} and ${LIMITS.name.max} characters.`);
    } else if (!NAME_RE.test(trimmed)) {
      errors.push("Name must contain letters only.");
    }
  }

  // --- phone: required, exactly 10 digits ---
  if (!isNonEmptyString(phone)) {
    errors.push("Phone number is required.");
  } else {
    const digitsOnly = phone.trim().replace(/[\s-]/g, "");
    if (!PHONE_RE.test(digitsOnly)) {
      errors.push("Phone number must be exactly 10 digits.");
    }
  }

  // --- email: required, valid format ---
  if (!isNonEmptyString(email)) {
    errors.push("Email is required.");
  } else {
    const trimmed = email.trim();
    if (trimmed.length > LIMITS.email.max || trimmed.length < LIMITS.email.min) {
      errors.push("Email length is invalid.");
    } else if (!EMAIL_RE.test(trimmed)) {
      errors.push("Please enter a valid email address.");
    }
  }

  // --- message: optional, max length only ---
  if (message !== undefined && message !== null && message !== "") {
    if (typeof message !== "string") {
      errors.push("Message must be a string.");
    } else if (message.trim().length > LIMITS.message.max) {
      errors.push(`Message must be under ${LIMITS.message.max} characters.`);
    }
  }

  if (errors.length > 0) {
    return { errors, data: null, isBot: false };
  }

  return {
    errors: [],
    isBot,
    data: {
      name: name.trim(),
      phone: phone.trim().replace(/[\s-]/g, ""),
      email: email.trim(),
      message: message ? message.trim() : "",
    },
  };
}

module.exports = { validateEnquiryPayload, LIMITS, EMAIL_RE, NAME_RE, PHONE_RE };
