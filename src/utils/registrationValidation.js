/**
 * Maps backend API errors, network errors, and validation responses to specific form fields.
 *
 * @param {Error|Object|string} err
 * @returns {{ field: string|null, message: string }}
 */
export function mapErrorToField(err) {
  const rawMessage = err?.message || (typeof err === 'string' ? err : '') || '';
  const directField = err?.field || err?.data?.field;
  const lowerMsg = rawMessage.toLowerCase();

  // 1. Explicit field returned by backend API
  if (directField) {
    if (directField === 'username' && (lowerMsg.includes('already taken') || lowerMsg.includes('already exists') || lowerMsg.includes('unique'))) {
      return {
        field: 'username',
        message: 'Username is already taken. Please choose another username.',
      };
    }
    if (directField === 'email' && (lowerMsg.includes('already exists') || lowerMsg.includes('already registered'))) {
      return {
        field: 'email',
        message: 'An account with this email address already exists. Please sign in.',
      };
    }
    if (directField === 'phoneNumber' && (lowerMsg.includes('already exists') || lowerMsg.includes('already registered'))) {
      return {
        field: 'phoneNumber',
        message: 'An account with this phone number already exists. Please sign in.',
      };
    }
    return {
      field: directField,
      message: rawMessage,
    };
  }

  // 2. Field-specific heuristics based on message content
  if (lowerMsg.includes('username')) {
    if (lowerMsg.includes('already taken') || lowerMsg.includes('already exists') || lowerMsg.includes('unique')) {
      return {
        field: 'username',
        message: 'Username is already taken. Please choose another username.',
      };
    }
    return {
      field: 'username',
      message: rawMessage,
    };
  }

  if (lowerMsg.includes('email')) {
    if (lowerMsg.includes('already exists') || lowerMsg.includes('already registered')) {
      return {
        field: 'email',
        message: 'An account with this email address already exists. Please sign in.',
      };
    }
    return {
      field: 'email',
      message: rawMessage,
    };
  }

  if (lowerMsg.includes('phone') || lowerMsg.includes('mobile')) {
    if (lowerMsg.includes('already exists') || lowerMsg.includes('already registered')) {
      return {
        field: 'phoneNumber',
        message: 'An account with this phone number already exists. Please sign in.',
      };
    }
    return {
      field: 'phoneNumber',
      message: rawMessage,
    };
  }

  if (lowerMsg.includes('password') && (lowerMsg.includes('match') || lowerMsg.includes('mismatch') || lowerMsg.includes('repeat'))) {
    return {
      field: 'confirmPassword',
      message: rawMessage || 'Passwords do not match.',
    };
  }

  if (lowerMsg.includes('password')) {
    return {
      field: 'password',
      message: rawMessage,
    };
  }

  if (lowerMsg.includes('name') && !lowerMsg.includes('username')) {
    return {
      field: 'name',
      message: rawMessage,
    };
  }

  // Generic server or network error
  return {
    field: null,
    message: rawMessage || 'Registration failed. Please check your details and try again.',
  };
}

