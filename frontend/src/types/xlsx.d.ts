declare module "xlsx" {
  interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }

  interface WorkSheet {
    "!cols"?: Array<{ wch?: number; wpx?: number }>;
    "!rows"?: Array<{ hpt?: number; hpx?: number }>;
    [cell: string]: any;
  }

  interface AOA2SheetOpts {
    dateNF?: string;
    cellDates?: boolean;
  }

  const utils: {
    book_new(): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name?: string): void;
    aoa_to_sheet(data: any[][], opts?: AOA2SheetOpts): WorkSheet;
    json_to_sheet(data: any[], opts?: any): WorkSheet;
    sheet_to_json(ws: WorkSheet, opts?: any): any[];
  };

  function writeFile(wb: WorkBook, filename: string, opts?: any): void;
  function read(data: any, opts?: any): WorkBook;
}
