import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  List,
  AlertCircle,
  Trash2,
  Book,
  Sun,
  PenLine,
  Save,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Types
interface Light {
  group: number;
  value: number;
  name: string;
}

interface EnhancedLightDialogProps {
  lights: Light[];
  sceneIndex: number;
  handleLightChange: (
    sceneIndex: number,
    lightIndex: number,
    field: "group" | "value",
    value: string
  ) => void;
  handleLightNameChange: (
    sceneIndex: number,
    lightIndex: number,
    name: string
  ) => void;
  handleDeleteLight: (sceneIndex: number, lightIndex: number) => void;
  handleAddLight: (sceneIndex: number) => void;
  handleBulkUpdate?: (sceneIndex: number, lights: Light[]) => void;
  handleBulkUpdateLights?: (sceneIndex: number, lights: Light[]) => void;
}

export const EnhancedLightDialog = React.memo<EnhancedLightDialogProps>(
  ({ lights, sceneIndex, handleBulkUpdate }) => {
    const [open, setOpen] = useState<boolean>(false);
    const [tableData, setTableData] = useState<
      Array<{
        name: string;
        group: string;
        value: string;
        nameValid: boolean;
        groupValid: boolean;
        valueValid: boolean;
      }>
    >([]);
    const [focusedCell, setFocusedCell] = useState<{
      row: number;
      col: string;
    } | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [validRowsCount, setValidRowsCount] = useState<number>(0);
    const [hasChanges, setHasChanges] = useState<boolean>(false);

    // Initialize table data when dialog opens
    useEffect(() => {
      if (open) {
        const initialData = lights.map((light) => ({
          name: light.name,
          group: light.group.toString(),
          value: light.value.toString(),
          nameValid: true,
          groupValid: true,
          valueValid: true,
        }));
        setTableData(initialData);
        setHasChanges(false);
      }
    }, [open, lights]);

    // Update valid rows count whenever table data changes
    useEffect(() => {
      const count = tableData.filter(
        (row) => row.groupValid && row.valueValid
      ).length;
      setValidRowsCount(count);
    }, [tableData]);

    const addRow = useCallback(() => {
      setTableData((prev) => [
        ...prev,
        {
          name: "",
          group: "1",
          value: "100",
          nameValid: true,
          groupValid: true,
          valueValid: true,
        },
      ]);
      setHasChanges(true);
    }, []);

    const deleteRow = useCallback(
      (index: number) => {
        if (tableData.length <= 1) return;
        const newData = [...tableData];
        newData.splice(index, 1);
        setTableData(newData);
        setHasChanges(true);
      },
      [tableData]
    );

    const validateValue = useCallback((value: string): boolean => {
      if (value === "") return false;
      const cleanValue = value.replace("%", "");
      const numValue = parseInt(cleanValue);
      return !isNaN(numValue) && numValue >= 0 && numValue <= 100;
    }, []);

    const extractNumberFromString = useCallback(
      (str: string): number | null => {
        const matches = str.match(/\d+/);
        if (matches && matches.length > 0) {
          return parseInt(matches[0]);
        }
        return null;
      },
      []
    );

    const validateAndExtractGroup = useCallback(
      (group: string): { isValid: boolean; extractedValue: string } => {
        if (group === "") return { isValid: false, extractedValue: "" };
        const groupNumber = extractNumberFromString(group);
        if (groupNumber !== null && groupNumber >= 1) {
          return { isValid: true, extractedValue: groupNumber.toString() };
        }
        return { isValid: false, extractedValue: group };
      },
      [extractNumberFromString]
    );

    const handleCellChange = useCallback(
      (rowIndex: number, field: "name" | "group" | "value", value: string) => {
        setTableData((prevData) => {
          const newData = [...prevData];
          if (field === "group") {
            const { isValid, extractedValue } = validateAndExtractGroup(value);
            newData[rowIndex].group = extractedValue;
            newData[rowIndex].groupValid = isValid;
          } else if (field === "value") {
            const isValid = validateValue(value);
            newData[rowIndex].value = value.replace("%", "");
            newData[rowIndex].valueValid = isValid;
          } else {
            newData[rowIndex].name = value;
            newData[rowIndex].nameValid = true;
          }
          return newData;
        });
        setHasChanges(true);
      },
      [validateAndExtractGroup, validateValue]
    );

    const getColumnIndex = useCallback((colName: string): number => {
      switch (colName) {
        case "name":
          return 0;
        case "group":
          return 1;
        case "value":
          return 2;
        default:
          return 0;
      }
    }, []);

    const getColumnName = useCallback((index: number): string => {
      switch (index) {
        case 0:
          return "name";
        case 1:
          return "group";
        case 2:
          return "value";
        default:
          return "name";
      }
    }, []);

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLTableElement>) => {
        e.preventDefault();

        if (!focusedCell) return;

        const { row, col } = focusedCell;
        const clipboardData = e.clipboardData;
        const pastedData = clipboardData.getData("text");
        const rows = pastedData.trim().split(/[\r\n]+/);

        if (rows.length > 1 || rows[0].includes("\t")) {
          setTableData((prevData) => {
            const newData = [...prevData];

            rows.forEach((rowData, rowIndex) => {
              const currentRowIndex = row + rowIndex;
              if (currentRowIndex >= newData.length) {
                newData.push({
                  name: "",
                  group: "1",
                  value: "100",
                  nameValid: true,
                  groupValid: true,
                  valueValid: true,
                });
              }

              const cells = rowData.split("\t");
              const colIndex = getColumnIndex(col);

              cells.forEach((cellValue, cellIndex) => {
                const currentColIndex = colIndex + cellIndex;
                if (currentColIndex >= 3) return;

                const colName = getColumnName(currentColIndex);
                if (colName === "name") {
                  newData[currentRowIndex].name = cellValue;
                  newData[currentRowIndex].nameValid = true;
                } else if (colName === "group") {
                  const { isValid, extractedValue } =
                    validateAndExtractGroup(cellValue);
                  newData[currentRowIndex].group = extractedValue;
                  newData[currentRowIndex].groupValid = isValid;
                } else if (colName === "value") {
                  const cleanValue = cellValue.replace("%", "");
                  newData[currentRowIndex].value = cleanValue;
                  newData[currentRowIndex].valueValid =
                    validateValue(cleanValue);
                }
              });
            });

            return newData;
          });
          setHasChanges(true);

          toast.success(`Đã dán ${rows.length} hàng dữ liệu`, {
            description: "Kiểm tra và điều chỉnh các ô không hợp lệ (viền đỏ).",
            duration: 3000,
          });
        } else {
          handleCellChange(row, col as "name" | "group" | "value", pastedData);
        }
      },
      [
        focusedCell,
        getColumnIndex,
        getColumnName,
        validateAndExtractGroup,
        validateValue,
        handleCellChange,
      ]
    );

    const handleCellFocus = useCallback(
      (rowIndex: number, colName: "name" | "group" | "value") => {
        setFocusedCell({ row: rowIndex, col: colName });
      },
      []
    );

    const handleSave = useCallback(() => {
      if (!handleBulkUpdate) return;

      try {
        if (tableData.length === 0) {
          toast.error("Không có dữ liệu để lưu");
          return;
        }

        // Create a mapping of original lights for reference
        const originalLightsMap = new Map();
        lights.forEach((light, index) => {
          originalLightsMap.set(index, light);
        });

        // Process each row, falling back to original values when invalid
        const updatedLights: Light[] = tableData.map((row, index) => {
          const originalLight =
            index < lights.length ? originalLightsMap.get(index) : null;

          return {
            // For name, use input if provided, otherwise use original or default
            name:
              row.name ||
              (originalLight ? originalLight.name : `Đèn ${index + 1}`),

            // For group, use input if valid, otherwise use original or default
            group: row.groupValid
              ? parseInt(row.group)
              : originalLight
              ? originalLight.group
              : 1,

            // For value, use input if valid, otherwise use original or default
            value: row.valueValid
              ? parseInt(row.value)
              : originalLight
              ? originalLight.value
              : 100,
          };
        });

        handleBulkUpdate(sceneIndex, updatedLights);
        setOpen(false);
        setHasChanges(false);

        // Count fields that were reverted to original values
        const revertedCount = tableData.reduce((count, row) => {
          return count + (!row.groupValid ? 1 : 0) + (!row.valueValid ? 1 : 0);
        }, 0);

        if (revertedCount > 0) {
          toast.success(`Đã cập nhật ${updatedLights.length} đèn thành công!`, {
            description: `Đã khôi phục giá trị gốc cho ${revertedCount} trường không hợp lệ.`,
            duration: 5000,
          });
        } else {
          toast.success(`Đã cập nhật ${updatedLights.length} đèn thành công!`);
        }
      } catch (error) {
        toast.error("Đã xảy ra lỗi khi xử lý dữ liệu");
        console.error(error);
      }
    }, [tableData, handleBulkUpdate, sceneIndex, lights]);

    const handleClose = useCallback(() => {
      if (hasChanges) {
        if (
          confirm("Bạn có thay đổi chưa được lưu. Bạn có chắc muốn hủy không?")
        ) {
          setOpen(false);
        }
      } else {
        setOpen(false);
      }
    }, [hasChanges]);

    return (
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen && hasChanges) {
            if (
              confirm(
                "Bạn có thay đổi chưa được lưu. Bạn có chắc muốn hủy không?"
              )
            ) {
              setOpen(newOpen);
            }
          } else {
            setOpen(newOpen);
          }
        }}
      >
        <div className="flex flex-row items-center justify-between">
          <div>
            <h3 className="font-semibold">Danh sách đèn</h3>
            <h4 className="text-sm font-medium text-gray-500">
              Tổng cộng có {lights.length} đèn
            </h4>
          </div>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Chỉnh sửa ({lights.length})
            </Button>
          </DialogTrigger>
        </div>
        <Separator />
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa danh sách đèn</DialogTitle>
            <DialogDescription>
              Chỉnh sửa chi tiết các đèn và ấn Lưu thay đổi để cập nhật.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="mb-2 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Label>Bảng dữ liệu đèn</Label>
                <Badge variant="outline" className="bg-blue-50">
                  {tableData.length} đèn
                </Badge>
                {validRowsCount !== tableData.length && (
                  <Badge variant="outline" className="bg-green-50">
                    {validRowsCount} hợp lệ
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                  className="flex items-center gap-1 text-gray-600"
                >
                  <Plus className="h-3 w-3" /> Thêm đèn
                </Button>
              </div>
            </div>

            <div
              className="border rounded-md flex-1 flex flex-col min-h-0"
              style={{ height: "60%" }}
            >
              <div className="bg-gray-50 border-b">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 py-2 text-center">#</TableHead>
                      <TableHead className="py-2">Tên đèn</TableHead>
                      <TableHead className="w-2/12 py-2">Group</TableHead>
                      <TableHead className="w-2/12 py-2">Độ sáng (%)</TableHead>
                      <TableHead className="w-12 py-2 text-center">
                        Xóa
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              <div className="flex-1 overflow-y-auto">
                <Table ref={tableRef} onPaste={handlePaste}>
                  <TableBody>
                    {tableData.map((row, index) => {
                      const isRowValid = row.groupValid && row.valueValid;

                      return (
                        <TableRow
                          key={index}
                          className={
                            !isRowValid ? "bg-red-50 hover:bg-red-50" : ""
                          }
                        >
                          <TableCell className="w-12 py-2 text-center">
                            {index + 1}
                          </TableCell>
                          <TableCell className="py-2 relative">
                            <PenLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <Input
                              value={row.name}
                              onChange={(e) =>
                                handleCellChange(index, "name", e.target.value)
                              }
                              onFocus={() => handleCellFocus(index, "name")}
                              placeholder="Tên đèn"
                              className="h-10 pl-8"
                            />
                          </TableCell>
                          <TableCell className="w-2/12 py-2 relative">
                            <Book className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <Input
                              value={row.group}
                              onChange={(e) =>
                                handleCellChange(index, "group", e.target.value)
                              }
                              onFocus={() => handleCellFocus(index, "group")}
                              type="number"
                              min="1"
                              className={`pl-8 h-10 ${
                                !row.groupValid
                                  ? "border-red-500 focus:ring-red-500"
                                  : ""
                              }`}
                            />
                          </TableCell>
                          <TableCell className="w-2/12 py-2 relative">
                            <Sun className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <Input
                              value={row.value}
                              onChange={(e) =>
                                handleCellChange(index, "value", e.target.value)
                              }
                              onFocus={() => handleCellFocus(index, "value")}
                              type="number"
                              min="0"
                              max="100"
                              className={`pl-8 h-10 ${
                                !row.valueValid
                                  ? "border-red-500 focus:ring-red-500"
                                  : ""
                              }`}
                            />
                          </TableCell>
                          <TableCell className="w-12 py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRow(index)}
                              disabled={tableData.length <= 1}
                              className="h-10 w-10"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertTitle>Lưu ý</AlertTitle>
            <AlertDescription>
              <p>
                Hỗ trợ chức năng dán dữ liệu từ Excel để cập nhật độ sáng đèn
                nhanh chóng.
              </p>
            </AlertDescription>
          </Alert>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={validRowsCount === 0 || !hasChanges}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Lưu thay đổi
              <Badge variant="outline" className="ml-1 bg-green-50">
                {validRowsCount}
              </Badge>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

EnhancedLightDialog.displayName = "EnhancedLightDialog";
