// Simple interactivity — expand as needed
document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("Navigation to:", link.textContent);
  });
});
