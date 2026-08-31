// funkcje pomocnicze

// sprawdzamy imię konia
function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') { // czy jest tekstem i czy nie jest puste
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim(); // zwracamy oczyszczony tekst
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

  return `${requireText(name, 'name')} ${formatCountryCode(countryCode)} ${birthYear}`; // indefikator konia
}

function formatBreederIdentifier({ name, countryCode }) {
  return `${requireText(name, 'name')} ${formatCountryCode(countryCode)}`; // indeficator hodowcy
}

module.exports = {
  formatHorseIdentifier,
  formatBreederIdentifier,
};
