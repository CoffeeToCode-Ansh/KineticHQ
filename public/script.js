/* ==========================================================
   KINETICHQ — frontend interactions + SMTP form client
   ========================================================== */

const questData = {
  power: {
    name: "Build Explosive Power",
    short: "Explosive Power",
    theme: "power",
    intro: "High-output sessions, athletic conditioning and specialists who keep every minute purposeful.",
    trainers: [
      ["✦","Alex Rivera","HIIT · Athletic Performance","8+ years · Power specialist"],
      ["↯","Noah Brooks","Speed · Conditioning","7+ years · Performance coach"],
      ["ϟ","Riley Stone","Combat Fitness · HIIT","9+ years · Conditioning"]
    ]
  },
  balance: {
    name: "Find Inner Balance",
    short: "Inner Balance",
    theme: "balance",
    intro: "Slower, smarter sessions for mobility, breath and recovery — without losing progress.",
    trainers: [
      ["◌","Maya Chen","Yoga · Mobility","12+ years · Mind-body coach"],
      ["⌁","Asha Kapoor","Mobility · Breathwork","10+ years · Recovery"],
      ["◍","Lena Woods","Sound · Restorative Yoga","9+ years · Sound practitioner"]
    ]
  },
  strength: {
    name: "Gain Raw Strength",
    short: "Raw Strength",
    theme: "strength",
    intro: "Progressive lifting, compound movements and coaching built around measurable strength.",
    trainers: [
      ["↯","James Okafor","Strength · Bodybuilding","10+ years · Strength coach"],
      ["◆","Sam Torres","Powerlifting · Technique","11+ years · Competitive coach"],
      ["▲","Theo Grant","Strongman · Performance","8+ years · Strength specialist"]
    ]
  },
  endurance: {
    name: "Endurance & Stamina",
    short: "Endurance",
    theme: "endurance",
    intro: "Build your engine with sustainable cardio, bodyweight strength and smarter pacing.",
    trainers: [
      ["⌁","Chris Miller","Endurance · Running","9+ years · Running coach"],
      ["◇","Kai Lewis","Calisthenics · Movement","7+ years · Bodyweight coach"],
      ["◉","Mia Santos","Cardio · Conditioning","8+ years · Endurance coach"]
    ]
  }
};

let currentGoal = "power";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setGoal(goal) {
  if (!questData[goal]) return;
  currentGoal = goal;
  const data = questData[goal];

  document.body.dataset.theme = data.theme;
  $$(".quest").forEach(btn => btn.classList.toggle("active", btn.dataset.goal === goal));

  const heroQuestName = $("#heroQuestName");
  const contactObjective = $("#contactObjective");
  const trainerIntro = $("#trainerIntro");

  if (heroQuestName) heroQuestName.textContent = data.short;
  if (contactObjective) contactObjective.value = data.name;
  if (trainerIntro) trainerIntro.textContent = data.intro;

  renderTrainers(data.trainers);
  showToast(`${data.name} selected`);
}

function renderTrainers(trainers) {
  const grid = $("#trainerGrid");
  if (!grid) return;
  grid.innerHTML = trainers.map(([icon,name,role,meta]) => `
    <article class="trainer-card">
      <div class="trainer-icon">${icon}</div>
      <h3>${name}</h3>
      <p>${role}</p>
      <small>${meta}</small>
    </article>
  `).join("");

  if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.fromTo(".trainer-card",
      {opacity:.35,y:14},
      {opacity:1,y:0,duration:.45,stagger:.06,ease:"power2.out"}
    );
  }
}

function initQuest() {
  $$(".quest").forEach(btn => btn.addEventListener("click", () => setGoal(btn.dataset.goal)));
}

function initMobileNav() {
  const toggle = $(".menu-toggle");
  const nav = $(".desktop-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    nav.style.display = open ? "" : "flex";
    if (!open) {
      nav.style.position = "absolute";
      nav.style.top = "70px";
      nav.style.left = "12px";
      nav.style.right = "12px";
      nav.style.padding = "18px";
      nav.style.borderRadius = "16px";
      nav.style.background = "rgba(248,241,231,.98)";
      nav.style.flexDirection = "column";
      nav.style.boxShadow = "0 20px 45px rgba(67,39,28,.12)";
    }
  });

  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    if (window.innerWidth <= 800) {
      nav.style.display = "none";
      toggle.setAttribute("aria-expanded", "false");
    }
  }));
}

function initHeroTilt() {
  const art = $("#heroArt");
  if (!art || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const layers = $$(".tilt-layer", art);

  art.addEventListener("pointermove", event => {
    const rect = art.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    layers.forEach((layer, index) => {
      const depth = (index + 1) * 5;
      layer.style.transform = `translate3d(${x * depth}px,${y * depth}px,0) rotateY(${x * 7}deg) rotateX(${-y * 5}deg)`;
    });
  });

  art.addEventListener("pointerleave", () => {
    layers.forEach(layer => layer.style.transform = "");
  });
}

function initCalculator() {
  const calculator = $("#calculator");
  const tabs = $$(".calc-tab");
  const height = $("#height");
  const weight = $("#weight");
  const age = $("#age");
  const sex = $("#sex");
  const activity = $("#activity");
  const resultLabel = $("#resultLabel");
  const resultValue = $("#resultValue");
  const resultNote = $("#resultNote");
  const error = $("#calcError");
  const button = $("#calculateBtn");

  if (!calculator) return;
  let mode = "bmi";

  function validate() {
    const h = Number(height.value);
    const w = Number(weight.value);
    const a = Number(age.value);

    if (!h || h < 100 || h > 230) return "Height must be between 100 and 230 cm.";
    if (!w || w < 30 || w > 250) return "Weight must be between 30 and 250 kg.";
    if ((mode === "bmr" || mode === "calories") && (!a || a < 13 || a > 100)) {
      return "Age must be between 13 and 100.";
    }
    return "";
  }

  function calculate() {
    const problem = validate();
    error.textContent = problem;
    if (problem) return;

    const h = Number(height.value);
    const w = Number(weight.value);
    const a = Number(age.value);

    if (mode === "bmi") {
      const bmi = w / Math.pow(h / 100, 2);
      resultLabel.textContent = "YOUR BMI";
      resultValue.textContent = bmi.toFixed(1);
      resultNote.textContent =
        bmi < 18.5 ? "Below common healthy range" :
        bmi < 25 ? "Healthy range" :
        bmi < 30 ? "Above common healthy range" : "High BMI range";
    } else {
      const base = 10 * w + 6.25 * h - 5 * a + (sex.value === "male" ? 5 : -161);
      if (mode === "bmr") {
        resultLabel.textContent = "ESTIMATED BMR";
        resultValue.textContent = Math.round(base);
        resultNote.textContent = "Calories/day at complete rest";
      } else {
        const calories = base * Number(activity.value);
        resultLabel.textContent = "ESTIMATED DAILY CALORIES";
        resultValue.textContent = Math.round(calories);
        resultNote.textContent = "Maintenance estimate";
      }
    }
  }

  tabs.forEach(tab => tab.addEventListener("click", () => {
    mode = tab.dataset.mode;
    tabs.forEach(item => item.classList.toggle("active", item === tab));
    calculator.classList.remove("mode-bmr","mode-calories");
    if (mode !== "bmi") calculator.classList.add(`mode-${mode}`);
    calculate();
  }));

  [height, weight, age, sex, activity].forEach(input => input.addEventListener("input", calculate));
  button.addEventListener("click", calculate);
  calculate();
}

function initWorkoutGenerator() {
  const button = $("#generateWorkout");
  const display = $("#workoutDisplay");
  const target = $("#workoutTarget");
  const time = $("#workoutTime");
  if (!button || !display) return;

  const exercises = {
    fullbody: ["Goblet squat","Push-ups","Romanian deadlift","Mountain climbers","Dead bug","Farmer carry"],
    upper: ["Push-ups","One-arm row","Shoulder press","Band pull-apart","Triceps dips","Plank"],
    lower: ["Goblet squat","Reverse lunge","Hip bridge","Calf raises","Wall sit","Dead bug"],
    core: ["Dead bug","Plank","Bird dog","Hollow hold","Mountain climbers","Side plank"]
  };

  button.addEventListener("click", () => {
    const list = exercises[target.value];
    const minutes = Number(time.value);
    const selected = list.slice(0, minutes <= 15 ? 4 : minutes <= 20 ? 5 : 6);

    display.innerHTML = `
      <small>KINETICHQ / ${minutes} MINUTES</small>
      <h3>${minutes}-minute ${target.options[target.selectedIndex].text} session.</h3>
      <p>Complete each movement with controlled form. Rest 30–45 seconds between rounds.</p>
      <div class="exercise-list">${selected.map((item, i) => `<span>${String(i+1).padStart(2,"0")} · ${item}</span>`).join("")}</div>
    `;
    showToast("Workout generated");
  });
}

function setFormNote(message, type = "") {
  const note = $("#formNote");
  if (!note) return;
  note.className = `form-note ${type}`.trim();
  note.textContent = message;
}

function validateContactForm(form) {
  const name = $("#contactName").value.trim();
  const email = $("#contactEmail").value.trim();
  const message = $("#contactMessage").value.trim();

  if (name.length < 2 || name.length > 80) return "Name must be 2–80 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
  if (message.length < 10 || message.length > 1500) return "Message must be 10–1500 characters.";
  return "";
}

async function initContactForm() {
  const form = $("#contactForm");
  const submit = $("#contactSubmit");
  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    setFormNote("");

    const validationError = validateContactForm(form);
    if (validationError) {
      setFormNote(validationError, "error");
      return;
    }

    // Bot honeypot: don't send automated-looking submissions to SMTP.
    if ($("#website")?.value.trim()) {
      form.reset();
      setFormNote("Thanks — your message has been received.");
      return;
    }

    submit.disabled = true;
    submit.dataset.originalText = submit.innerHTML;
    submit.innerHTML = "Sending…";
    setFormNote("Sending your message to KineticHQ…", "loading");

    const payload = {
      name: $("#contactName").value.trim(),
      email: $("#contactEmail").value.trim(),
      objective: $("#contactObjective").value,
      message: $("#contactMessage").value.trim(),
      website: $("#website").value.trim()
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = Array.isArray(result.errors)
          ? result.errors.join(" ")
          : (result.error || "We could not send your message. Please try again.");
        throw new Error(message);
      }

      setFormNote(result.message || "Your message was sent successfully.", "success");
      form.reset();
      $("#contactObjective").value = questData[currentGoal].name;
      showToast("Message sent successfully");
    } catch (error) {
      console.error(error);
      setFormNote(error.message || "Something went wrong. Please try again.", "error");
    } finally {
      submit.disabled = false;
      submit.innerHTML = submit.dataset.originalText || "Send to KineticHQ ↗";
    }
  });
}

function initAuthModal() {
  const modal = $("#authModal");
  const close = $("#modalClose");
  const title = $("#authTitle");
  const nameWrap = $("#authNameWrap");
  const submit = $("#authSubmit");
  const form = $("#authForm");

  $$("[data-auth]").forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    const mode = button.dataset.auth;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden","false");

    if (mode === "signup") {
      title.textContent = "Join KineticHQ";
      nameWrap.style.display = "block";
      submit.textContent = "Create account →";
    } else {
      title.textContent = "Login to KineticHQ";
      nameWrap.style.display = "none";
      submit.textContent = "Login →";
    }
  }));

  function hide() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
  }

  close?.addEventListener("click", hide);
  modal?.addEventListener("click", e => { if (e.target === modal) hide(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") hide(); });

  form?.addEventListener("submit", e => {
    e.preventDefault();
    hide();
    showToast("Demo authentication UI — backend auth is a later task.");
  });
}

function initGSAP() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.from(".hero-copy > *", {
      y:32, opacity:0, duration:.85, stagger:.08, ease:"power3.out", delay:.1
    });
    gsap.from(".hero-art", {
      x:70, opacity:0, duration:1.1, ease:"power3.out", delay:.2
    });

    gsap.to(".orbit-one", {rotateZ:360, duration:24, repeat:-1, ease:"none"});
    gsap.to(".orbit-two", {rotateZ:-360, duration:18, repeat:-1, ease:"none"});

    $$(".reveal").forEach(element => {
      gsap.from(element, {
        y:32, opacity:0, duration:.7, ease:"power2.out",
        scrollTrigger:{trigger:element,start:"top 84%",once:true}
      });
    });
  }
}

function init() {
  initQuest();
  setGoal("power");
  initMobileNav();
  initHeroTilt();
  initCalculator();
  initWorkoutGenerator();
  initContactForm();
  initAuthModal();
  initGSAP();
}

document.addEventListener("DOMContentLoaded", init);
