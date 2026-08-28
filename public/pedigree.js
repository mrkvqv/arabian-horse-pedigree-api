const form = document.querySelector('#pedigree-form');
const message = document.querySelector('#message');
const tree = document.querySelector('#tree');

function horseCard(horse) {
  const card = document.createElement('article');
  card.className = 'horse';
  const identifier = document.createElement('strong');
  identifier.textContent = horse.identifier;
  const details = document.createElement('span');
  details.textContent = `${horse.sex}, ${horse.birthYear}, ${horse.countryCode}`;
  card.append(identifier, details);
  return card;
}

function parentBranch(title, horse) {
  const branch = document.createElement('div');
  const heading = document.createElement('p');
  heading.className = 'parent-title';
  heading.textContent = title;
  branch.append(heading);

  if (horse) {
    branch.append(createTree(horse));
  } else {
    const unknown = document.createElement('div');
    unknown.className = 'unknown';
    unknown.textContent = 'Brak danych';
    branch.append(unknown);
  }

  return branch;
}

function createTree(horse) {
  const subtree = document.createElement('div');
  subtree.className = 'subtree';
  subtree.append(horseCard(horse));

  if (horse.mother || horse.father) {
    const parents = document.createElement('div');
    parents.className = 'parents';
    parents.append(parentBranch('Matka', horse.mother));
    parents.append(parentBranch('Ojciec', horse.father));
    subtree.append(parents);
  }

  return subtree;
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

    tree.append(createTree(data.horse));
  } catch (error) {
    message.textContent = error.message;
  }
});
