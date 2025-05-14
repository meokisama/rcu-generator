import React, { useState, useRef, useEffect } from "react";
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
  TableIcon,
  AlertCircle,
  Copy,
  Trash2,
  Book,
  Sun,
  PenLine,
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

interface Light {
  group: number;
  value: number;
  name: string;
}

interface ExcelImportDialogProps {
  sceneIndex: number;
  onImport: (lights: Light[]) => void;
}

const ExcelImportDialog: React.FC<ExcelImportDialogProps> = ({ onImport }) => {
  const [tableData, setTableData] = useState<
    Array<{
      name: string;
      group: string;
      value: string;
      nameValid: boolean;
      groupValid: boolean;
      valueValid: boolean;
    }>
  >([
    {
      name: "",
      group: "1",
      value: "100",
      nameValid: true,
      groupValid: true,
      valueValid: true,
    },
  ]);

  const [open, setOpen] = useState<boolean>(false);
  const [focusedCell, setFocusedCell] = useState<{
    row: number;
    col: string;
  } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [validRowsCount, setValidRowsCount] = useState<number>(0);

  useEffect(() => {
    const count = tableData.filter(
      (row) => row.groupValid && row.valueValid
    ).length;
    setValidRowsCount(count);
  }, [tableData]);

  const addRow = () => {
    setTableData([
      ...tableData,
      {
        name: "",
        group: "1",
        value: "100",
        nameValid: true,
        groupValid: true,
        valueValid: true,
      },
    ]);
  };

  const deleteRow = (index: number) => {
    if (tableData.length <= 1) return;
    const newData = [...tableData];
    newData.splice(index, 1);
    setTableData(newData);
  };

  const validateValue = (value: string): boolean => {
    // Empty values are valid and will be converted to 100
    if (value === "" || value.trim() === "") return true;

    // Handle "on" as 100 and "off" as 0
    if (value.trim().toLowerCase() === "on") return true;
    if (value.trim().toLowerCase() === "off") return true;

    const cleanValue = value.replace("%", "");
    const numValue = parseInt(cleanValue);

    return !isNaN(numValue) && numValue >= 0 && numValue <= 100;
  };

  const extractNumberFromString = (str: string): number | null => {
    const matches = str.match(/\d+/);
    if (matches && matches.length > 0) {
      return parseInt(matches[0]);
    }
    return null;
  };

  const validateAndExtractGroup = (
    group: string
  ): { isValid: boolean; extractedValue: string } => {
    if (group === "") return { isValid: false, extractedValue: "" };

    const groupNumber = extractNumberFromString(group);
    if (groupNumber !== null && groupNumber >= 1) {
      return { isValid: true, extractedValue: groupNumber.toString() };
    }

    return { isValid: false, extractedValue: group };
  };

  const handleCellChange = (
    rowIndex: number,
    field: "name" | "group" | "value",
    value: string
  ) => {
    const newData = [...tableData];

    if (field === "group") {
      const { isValid, extractedValue } = validateAndExtractGroup(value);
      newData[rowIndex].group = extractedValue;
      newData[rowIndex].groupValid = isValid;
    } else if (field === "value") {
      const isValid = validateValue(value);

      // Convert "on" to 100 and "off" to 0
      let processedValue = value.replace("%", "");

      // Handle empty value - set to 100
      if (processedValue.trim() === "") {
        processedValue = "100";
      } else if (processedValue.trim().toLowerCase() === "on") {
        processedValue = "100";
      } else if (processedValue.trim().toLowerCase() === "off") {
        processedValue = "0";
      }

      newData[rowIndex].value = processedValue;
      newData[rowIndex].valueValid = isValid;
    } else {
      newData[rowIndex].name = value;
      newData[rowIndex].nameValid = true;
    }

    setTableData(newData);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTableElement>) => {
    e.preventDefault();

    if (!focusedCell) return;

    const { row, col } = focusedCell;
    const clipboardData = e.clipboardData;
    const pastedData = clipboardData.getData("text");
    // Sử dụng split thông thường để giữ lại các dòng trống
    const rows = pastedData.trim().split(/\r?\n/);

    if (rows.length > 1 || rows[0].includes("\t")) {
      const newData = [...tableData];

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
            // Convert "on" to 100 and "off" to 0
            let processedValue = cellValue.replace("%", "");

            // Handle empty rows - set to 100
            if (processedValue.trim() === "") {
              processedValue = "100";
            } else if (processedValue.trim().toLowerCase() === "on") {
              processedValue = "100";
            } else if (processedValue.trim().toLowerCase() === "off") {
              processedValue = "0";
            }

            newData[currentRowIndex].value = processedValue;
            newData[currentRowIndex].valueValid = validateValue(processedValue);
          }
        });
      });

      setTableData(newData);

      toast.success(`Đã dán ${rows.length} hàng dữ liệu`, {
        description: "Kiểm tra và điều chỉnh các ô không hợp lệ (viền đỏ).",
        duration: 3000,
      });
    } else {
      handleCellChange(row, col as "name" | "group" | "value", pastedData);
    }
  };

  const getColumnIndex = (colName: string): number => {
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
  };

  const getColumnName = (index: number): string => {
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
  };

  const handleImport = () => {
    try {
      if (tableData.length === 0) {
        toast.error("Vui lòng nhập ít nhất một đèn");
        return;
      }

      const validRows = tableData.filter(
        (row) => row.groupValid && row.valueValid
      );

      if (validRows.length === 0) {
        toast.error("Không có dữ liệu hợp lệ để nhập");
        return;
      }

      const newLights: Light[] = validRows.map((row) => ({
        name: row.name || "Đèn chưa đặt tên",
        group: parseInt(row.group) || 1,
        value: parseInt(row.value) || 100,
      }));

      onImport(newLights);
      setOpen(false);

      const invalidCount = tableData.length - validRows.length;
      if (invalidCount > 0) {
        toast.success(`Đã nhập ${validRows.length} đèn thành công!`, {
          description: `Đã bỏ qua ${invalidCount} hàng không hợp lệ.`,
          duration: 5000,
        });
      } else {
        toast.success(`Đã nhập ${validRows.length} đèn thành công!`);
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi xử lý dữ liệu");
      console.error(error);
    }
  };

  const handleCellFocus = (
    rowIndex: number,
    colName: "name" | "group" | "value"
  ) => {
    setFocusedCell({ row: rowIndex, col: colName });
  };

  useEffect(() => {
    if (!open) {
      setTableData([
        {
          name: "",
          group: "1",
          value: "100",
          nameValid: true,
          groupValid: true,
          valueValid: true,
        },
      ]);
      setFocusedCell(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <TableIcon className="h-4 w-4" />
          <span>Nhập từ Excel</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nhập dữ liệu đèn từ Excel</DialogTitle>
          <DialogDescription>
            Sao chép dữ liệu nguyên cả cột từ Excel và dán vào bảng dưới đây.
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
                <Copy className="h-3 w-3" /> Thêm hàng
              </Button>
            </div>
          </div>

          <div
            className="border rounded-md flex-1 flex flex-col min-h-0"
            style={{ height: "65%" }}
          >
            <div className="bg-gray-50 border-b">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 pl-5">Tên đèn</TableHead>
                    <TableHead className="w-2/12 py-2">Group</TableHead>
                    <TableHead className="w-2/12 py-2">Độ sáng (%)</TableHead>
                    <TableHead className="w-12 py-2 text-center">Xóa</TableHead>
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
                        <TableCell className="py-2 relative pl-4">
                          <PenLine className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
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
              - Khi nhập dữ liệu, chỉ cần copy cột dữ liệu từ Excel và dán vào
              cột tương ứng là được, không cần làm gì khác.
            </p>
            <p>
              - Các ô có viền đỏ là không hợp lệ và sẽ bị bỏ qua nếu nhập dữ
              liệu.
            </p>
            <p>
              - Nút Thêm hàng chỉ để dự phòng{" "}
              <strong>nếu muốn thêm hàng thủ công</strong>. Còn mặc định copy
              bên excel bao nhiêu hàng thì khi dán sẽ tự thêm bấy nhiêu.
            </p>
          </AlertDescription>
        </Alert>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Hủy
          </Button>
          <Button onClick={handleImport} disabled={validRowsCount === 0}>
            Nhập dữ liệu
            <Badge variant="outline" className="ml-2 bg-green-50">
              {validRowsCount}
            </Badge>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExcelImportDialog;
