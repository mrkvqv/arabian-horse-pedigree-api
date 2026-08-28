const form = document.querySelector('#pedigree-form');
const message = document.querySelector('#message');
const tree = document.querySelector('#tree');

function horseCard(horse, relation) {
  const card = document.createElement('article');
  card.className = 'horse';
  const relationship = document.createElement('p');
  relationship.className = 'relationship';
  relationship.textContent = relation;
  const identifier = document.createElement('strong');
  identifier.textContent = horse.identifier;
  const details = document.createElement('span');
  details.textContent = `${horse.sex}, ${horse.birthYear}, ${horse.countryCode}`;
  card.append(relationship, identifier, details);
  return card;
}

function createGenerations(rootHorse) {
  let generation = 0;
  let currentHorses = [{ horse: rootHorse, relation: 'Wybrany koń' }];

  while (currentHorses.length > 0) {
    const section = document.createElement('section');
    section.className = 'generation';
    const heading = document.createElement('h2');
    heading.textContent = generation === 0 ? 'Wybrany koń' : `Pokolenie ${generation}`;
    const cards = document.createElement('div');
    cards.className = 'generation-cards';
    const nextGeneration = [];

    currentHorses.forEach(({ horse, relation }) => {
      cards.append(horseCard(horse, relation));
      if (horse.mother) nextGeneration.push({ horse: horse.mother, relation: `Matka → ${relation}` });
      if (horse.father) nextGeneration.push({ horse: horse.father, relation: `Ojciec → ${relation}` });
    });

    section.append(heading, cards);
    tree.append(section);
    currentHorses = nextGeneration;
    generation += 1;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  tree.replaceChildren();

  const name = document.querySelector('#name').value.trim();
  const birthYear = document.querySelector('#birth-year').value;
  const countryCode = document.querySelector('#country-code').value.trim().toUpperCase();
  const depth = document.querySelector('#depth').value;
  const login = document.querySelector('#login').value;
  const password = document.querySelector('#password').value;
  const query = new URLSearchParams({ birthYear, countryCode, depth });
  const authorization = `Basic ${btoa(`${login}:${password}`)}`;

  try {
    const response = await fetch(`/horses/${encodeURIComponent(name)}/pedigree?${query}`, {
      headers: { Authorization: authorization },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Nie udało się pobrać rodowodu.');
    }

    createGenerations(data.horse);
  } catch (error) {
    message.textContent = error.message;
  }
});
