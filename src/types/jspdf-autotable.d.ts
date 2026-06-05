import "jspdf";

declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
  }
}

declare module "jspdf-autotable" {
  export default function autoTable(
    doc: import("jspdf").jsPDF,
    options: Record<string, unknown>
  ): void;
}
