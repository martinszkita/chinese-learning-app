(async () => {
  const content = document.getElementById('content');
  content.textContent = 'Loading study materials…';
  try {
    const repository = window.ChineseApp.repository.create();
    const snapshot = await repository.load();
    window.ChineseApp.materialRepository = repository;
    window.ChineseApp.start(snapshot);
  } catch (error) {
    console.error('Cannot load study materials', error);
    content.replaceChildren();
    const message = document.createElement('p');
    message.textContent = location.protocol === 'file:'
      ? 'Start the app with npm start, then open http://127.0.0.1:3000. Materials are stored in the database.'
      : 'Study materials could not be loaded. Check that the application server is running and reload the page.';
    content.append(message);
  }
})();
