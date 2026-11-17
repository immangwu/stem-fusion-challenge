export const TEMPLATES: Record<1 | 2 | 3, { file: string; label: string }> = {
  1: { file: 'Phase1-Maths-Report-Template.docx', label: 'Phase 1 template (Maths)' },
  2: { file: 'Phase2-Chemistry-Report-Template.docx', label: 'Phase 2 template (Chemistry)' },
  3: { file: 'Phase3-Physics-Report-Template.docx', label: 'Phase 3 template (Physics)' },
};
export const templateHref = (n: 1 | 2 | 3) => `/templates/${TEMPLATES[n].file}`;
