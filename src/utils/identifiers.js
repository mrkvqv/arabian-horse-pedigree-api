function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function formatCountryCode(countryCode) {
  const code = requireText(countryCode, 'countryCode').toUpperCase();

  if (!/^[A-Z]{2}$/.test(code)) {
    throw new Error('countryCode must contain exactly two letters.');
  }

  return code;
}

function formatHorseIdentifier({ name, countryCode, birthYear }) {
  if (!Number.isInteger(birthYear) || birthYear < 1) {
    throw new Error('birthYear must be a positive integer.');
  }

  return `${requireText(name, 'name')} ${formatCountryCode(countryCode)} ${birthYear}`;
}

function formatBreederIdentifier({ name, countryCode }) {
  return `${requireText(name, 'name')} ${formatCountryCode(countryCode)}`;
}

module.exports = {
  formatHorseIdentifier,
  formatBreederIdentifier,
};
