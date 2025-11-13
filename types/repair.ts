export interface RepairPhoto {
  id: string;
  url: string;
  uploadedAt: string;
  uploadedBy: "desktop" | "mobile";
  name?: string;
}
