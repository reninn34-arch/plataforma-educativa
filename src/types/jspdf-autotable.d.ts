declare module "jspdf-autotable" {
  export default function autoTable(
    doc: import("jspdf").jsPDF,
    options: Record<string, unknown>
  ): import("jspdf").jsPDF & { lastAutoTable?: { finalY: number } };
}
