export const RUBRIC_VERSION = 'v1';

export type Criterion = { key: string; label: string; max: number; desc: string };
export type PhaseNo = 1 | 2 | 3;

export const RUBRICS: Record<PhaseNo, { subject: string; total: number; criteria: Criterion[] }> = {
  1: {
    subject: 'Mathematics',
    total: 20,
    criteria: [
      { key: 'modelling', label: 'Mathematical modelling', max: 5, desc: 'Clear equations or relations describing the model, with variables defined.' },
      { key: 'calculations', label: 'Calculations and accuracy', max: 5, desc: 'Correct working shown step by step, with units.' },
      { key: 'data_analysis', label: 'Data, graphs and analysis', max: 4, desc: 'Labelled tables and graphs, trends interpreted, errors or uncertainty noted.' },
      { key: 'optimization', label: 'Optimization or logical reasoning', max: 4, desc: 'Options or values compared and the best choice justified with maths.' },
      { key: 'clarity', label: 'Clarity and presentation', max: 2, desc: 'Logical structure, readable PDF, correct notation.' },
    ],
  },
  2: {
    subject: 'Chemistry',
    total: 20,
    criteria: [
      { key: 'concepts', label: 'Chemical concepts identified', max: 5, desc: 'Correct principle (reaction type, rate, pH, redox, material properties) named and explained.' },
      { key: 'equations', label: 'Equations and stoichiometry', max: 4, desc: 'Balanced equations; quantities and concentrations calculated correctly.' },
      { key: 'method_data', label: 'Experimental method and data', max: 4, desc: 'Procedure, controlled variables, observations or measurements recorded.' },
      { key: 'analysis', label: 'Analysis and justification', max: 4, desc: 'Results explained using chemistry; sources of error and improvements discussed.' },
      { key: 'safety', label: 'Safety and environment', max: 3, desc: 'Hazards identified, safe handling and disposal, eco-friendly choices.' },
    ],
  },
  3: {
    subject: 'Physics',
    total: 20,
    criteria: [
      { key: 'principles', label: 'Physical principles applied', max: 5, desc: 'Correct laws (forces, energy, heat, fluids, electricity, optics) linked to how the model works.' },
      { key: 'calculations', label: 'Calculations and units', max: 5, desc: 'Correct formulas, substitution, final answers with units.' },
      { key: 'design', label: 'Design and engineering reasoning', max: 4, desc: 'Design choices justified; alternatives considered and trade-offs explained.' },
      { key: 'validation', label: 'Measurement and validation', max: 4, desc: 'Predicted values compared with measured values, with percentage error.' },
      { key: 'clarity', label: 'Clarity and diagrams', max: 2, desc: 'Labelled diagrams and a clear explanation of how it works.' },
    ],
  },
};

export const JURY_RUBRIC: { total: number; criteria: Criterion[] } = {
  total: 40,
  criteria: [
    { key: 'working', label: 'Working prototype', max: 10, desc: 'Does it do what the report says?' },
    { key: 'integration', label: 'Integration of Maths, Physics and Chemistry', max: 8, desc: 'All three subjects genuinely used.' },
    { key: 'innovation', label: 'Innovation and creativity', max: 6, desc: 'Original ideas and approach.' },
    { key: 'build', label: 'Build quality and use of materials', max: 6, desc: 'Craftsmanship and sensible materials.' },
    { key: 'oral', label: 'Oral explanation and answering questions', max: 6, desc: 'Clear explanation; confident answers.' },
    { key: 'teamwork', label: 'Teamwork and individual contribution', max: 4, desc: 'Every member can explain their part.' },
  ],
};

export const CUSTOM_TOPIC_CHECKS: { key: string; label: string; desc: string }[] = [
  { key: 'three_subjects', label: 'Three-subject link', desc: 'Uses a specific concept from each of Maths, Physics and Chemistry.' },
  { key: 'buildable', label: 'Buildable', desc: 'A physical model can be made with low-cost materials within the timeline.' },
  { key: 'measurable', label: 'Measurable', desc: 'At least one quantity can be measured and compared.' },
  { key: 'safe_original', label: 'Safe and original', desc: 'No hazardous chemicals, open flame or high voltage; not a duplicate of a listed topic.' },
];

export const TIEBREAK = 'Ties are broken by jury marks, then Physics, then Chemistry, then Maths.';
