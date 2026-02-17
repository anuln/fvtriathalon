type Screen = "boot" | "stage" | "results";

const app = document.querySelector<HTMLDivElement>("#app");
const TOTAL_STAGES = 3;

let screen: Screen = "boot";
let stageIndex = 0;
let finalTriPoints = 0;

function advanceRun(): void {
  if (screen === "boot") {
    screen = "stage";
    stageIndex = 0;
    return;
  }

  if (screen === "stage") {
    if (stageIndex < TOTAL_STAGES - 1) {
      stageIndex += 1;
      return;
    }

    screen = "results";
    finalTriPoints = 987;
  }
}

function render(): void {
  if (!app) {
    return;
  }

  app.innerHTML = "";

  if (screen === "boot") {
    const start = document.createElement("button");
    start.textContent = "START";
    start.setAttribute("data-testid", "start");
    start.addEventListener("click", () => {
      advanceRun();
      render();
    });
    app.appendChild(start);
    return;
  }

  if (screen === "stage") {
    const stage = document.createElement("h2");
    stage.textContent = `Stage ${stageIndex + 1}/3`;
    app.appendChild(stage);

    const next = document.createElement("button");
    next.textContent = "NEXT STAGE";
    next.setAttribute("data-testid", "advance-stage");
    next.addEventListener("click", () => {
      advanceRun();
      render();
    });
    app.appendChild(next);
    return;
  }

  const title = document.createElement("h1");
  title.textContent = "FINAL TRIPOINTS";
  app.appendChild(title);

  const score = document.createElement("p");
  score.textContent = String(finalTriPoints);
  app.appendChild(score);
}

(window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest = () => {
  advanceRun();
  render();
};

render();
