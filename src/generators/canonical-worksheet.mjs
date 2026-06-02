export function buildCanonicalWorksheet(config) {
  const generatorLineage = {
    id: config.generator.id,
    version: config.generator.version,
    seed: String(config.seed),
    variant: config.generator.variant
  };

  const questions = config.items.map((item, index) => {
    const questionId = `q${index + 1}`;
    return {
      id: questionId,
      type: item.questionType,
      prompt: item.problemText,
      content: [
        ...item.content,
        { kind: "answerBox", answerRef: questionId, label: item.answerLabel || "answer" }
      ],
      answerRef: questionId,
      metadata: {
        difficulty: item.difficulty,
        skills: item.tags,
        generator: {
          ...generatorLineage,
          seed: `${generatorLineage.seed}:${index + 1}`
        }
      }
    };
  });

  const answerKey = config.items.map((item, index) => {
    const entry = {
      id: `a${index + 1}`,
      questionId: `q${index + 1}`,
      answer: item.correctAnswer,
      normalization: item.normalization,
      workedSolution: item.workedSolution.map((step) => typeof step === "string" ? { text: step } : step)
    };

    if (item.alternates?.length) entry.alternates = item.alternates;
    if (item.tolerance !== undefined) entry.tolerance = item.tolerance;

    return entry;
  });

  const worksheet = {
    schemaVersion: "1.0.0",
    id: `${config.generator.id}-${slugSeed(config.seed)}`,
    title: config.title,
    subject: "math",
    gradeBand: config.gradeBand,
    topic: config.topic,
    learningGoals: config.learningGoals,
    instructions: config.instructions,
    sections: [
      {
        id: "practice",
        title: config.sectionTitle || "Practice",
        questions
      }
    ],
    answerKey,
    metadata: {
      createdAt: "2026-06-02T00:00:00Z",
      generator: generatorLineage,
      format: config.format,
      standards: config.standards,
      versioning: {
        schemaVersion: "1.0.0",
        contentVersion: "1.0.0",
        migration: { strategy: "none", notes: [] }
      }
    }
  };

  const manifest = config.items.map((item, index) => ({
    questionId: `q${index + 1}`,
    problemText: item.problemText,
    variables: item.variables,
    correctAnswer: item.correctAnswer,
    workedSolution: item.workedSolution,
    difficulty: item.difficulty,
    tags: item.tags,
    lineage: {
      generatorId: config.generator.id,
      generatorVersion: config.generator.version,
      variant: config.generator.variant,
      seed: String(config.seed),
      itemIndex: index,
      rngPath: [config.generator.id, String(index + 1)],
      schemaVersion: "1.0.0"
    }
  }));

  return { worksheet, manifest };
}

function slugSeed(seed) {
  return String(seed).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "seed";
}
