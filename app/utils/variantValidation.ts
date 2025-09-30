interface ValidationResult {
  isValid: boolean;
  parsedValue: string;
  skipReason?: string;
}

export const validateNonEmptyValue = (value: string): ValidationResult => {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      parsedValue: '',
      skipReason: 'empty value'
    };
  }

  const parsedValue = parseFloat(value).toString();

  if (parsedValue === 'NaN') {
    return {
      isValid: false,
      parsedValue: '',
      skipReason: 'invalid numeric format'
    };
  }

  return {
    isValid: true,
    parsedValue
  };
};
