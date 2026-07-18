document.getElementById('storyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const story = document.getElementById('userStory').value;
  if (!story) return alert("Please write your story");

  // Show preview area
  document.getElementById('preview').style.display = 'block';
  
  // TODO: Call Cloudflare Worker here later
  alert("Story received! (Preview generation coming next)");
});