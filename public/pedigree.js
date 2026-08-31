const form = document.querySelector('#pedigree-form');
const message = document.querySelector('#message'); // miejscie, gdzie pokzujemy bląd
const tree = document.querySelector('#tree'); // pokazujey rodowód

// jedna karta
function horseCard(horse, relation) {
  // nowy element HTML
  const card = document.createElement('article');
  card.className = 'horse';
  // opis relacji
  const relationship = document.createElement('p');
  relationship.className = 'relationship';
  relationship.textContent = relation;
  // indefikator
  const identifier = document.createElement('strong');
  identifier.textContent = horse.identifier; // pochodzie z API
  // dodatkowe informacje
  const details = document.createElement('span');
  details.textContent = `${horse.sex}, ${horse.birthYear}, ${horse.countryCode}`;
  card.append(relationship, identifier, details);
  return card;
}
// funkcja, budująca rodowów
function createGenerations(rootHorse) {
  let generation = 0;
  // tablica koni w tym pokoleniu
  let currentHorses = [{ horse: rootHorse, relation: 'Wybrany koń' }];

  while (currentHorses.length > 0) {
    // block dla jednego pokolenia
    const section = document.createElement('section');
    section.className = 'generation';
    // nagłowek pokolenia
    const heading = document.createElement('h2');
    heading.textContent = generation === 0 ? 'Wybrany koń' : `Pokolenie ${generation}`;
    // div dla wszystkich kartek jednego pokolenia
    const cards = document.createElement('div');
    cards.className = 'generation-cards';
    // pusta tablica na natsępne pokolenie
    const nextGeneration = [];

    currentHorses.forEach(({ horse, relation }) => {
      cards.append(horseCard(horse, relation));
      if (horse.mother) nextGeneration.push({ horse: horse.mother, relation: `Matka → ${relation}` });
      if (horse.father) nextGeneration.push({ horse: horse.father, relation: `Ojciec → ${relation}` });
    });
    // wstawiamy do sekcji nagłówek i dib z kartami
    section.append(heading, cards);
    // wstawiamy sekcję do tree (zeby bylo widoczne)
    tree.append(section);
    currentHorses = nextGeneration;
    generation += 1;
  }
}

// ubsługa przecisku
form.addEventListener('submit', async (event) => { // Pokaż rodowód
  event.preventDefault(); // blokuje przeładowanie strony
  message.textContent = ''; // usunięcie poprzedniego kom blędu
  tree.replaceChildren(); // usunięcie poprzedniego rodowodu

  // dane, które wpisał uzytkownik w polu HTML
  const name = document.querySelector('#name').value.trim();
  const birthYear = document.querySelector('#birth-year').value;
  const countryCode = document.querySelector('#country-code').value.trim().toUpperCase();
  const depth = document.querySelector('#depth').value;
  const login = document.querySelector('#login').value;
  const password = document.querySelector('#password').value;
  const query = new URLSearchParams({ birthYear, countryCode, depth }); // tworzymy poprawny tekst parametrów URL
  const authorization = `Basic ${btoa(`${login}:${password}`)}`; // btoa koduje tekst w Base64

  try {
    // wysyłamy żądanie do API
    const response = await fetch(`/horses/${encodeURIComponent(name)}/pedigree?${query}`, { // encodeURIComponent jest potrzeben do biezpiecznego url
      headers: { Authorization: authorization }, // passport yzywa go do spr admina
    });
    // odpowiedź z serwera to JSON
    const data = await response.json();

    if (!response.ok) { // 200 - 299
      throw new Error(data.error || 'Nie udało się pobrać rodowodu.'); // przerywa try
    }

    createGenerations(data.horse);
  } catch (error) {
    message.textContent = error.message;
  }
});
