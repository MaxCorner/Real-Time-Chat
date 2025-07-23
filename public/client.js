let socket;
let isAdmin = false;

(async () => {
  const choice = prompt("Register or Login? (r/l)").toLowerCase();
  const username = prompt("Username:");
  const password = prompt("Password:");

  if (choice === 'r') {
    await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    alert('Registered! Now login.');
  }

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  const token = data.token;

  const room = prompt("Enter room name:") || "1";

  socket = io({
    auth: { token }
  });

  socket.emit('join room', { room });

  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const messages = document.getElementById('messages');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
      socket.emit('chat message', input.value);
      input.value = '';
    }
  });

  socket.on('chat history', (history) => {
    history.forEach(data => addMessage(data));
  });

  socket.on('chat message', (data) => {
    addMessage(data);
  });

  socket.on('message deleted', (messageId) => {
    const li = document.getElementById(messageId);
    if (li) li.remove();
  });

  socket.on('connect', () => {
    isAdmin = parseJwt(token).role === 'admin';
  });

  function addMessage(data) {
    const li = document.createElement('li');
    li.id = data._id;
    li.textContent = `${data.username}: ${data.message}`;

    if (isAdmin && data._id) {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.onclick = () => {
        socket.emit('delete message', data._id);
      };
      li.appendChild(delBtn);
    }

    messages.appendChild(li);
    window.scrollTo(0, document.body.scrollHeight);
  }

  function parseJwt(token) {
    return JSON.parse(atob(token.split('.')[1]));
  }
})();
