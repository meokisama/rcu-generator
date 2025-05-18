import { Light, Scene, Schedule } from "@/types/app-types";
import csvParser from "csv-parser";
import { Readable } from "stream";
import { convertBrightnessValue, checkContinuousGroups } from "./csv-parser";

// Types for internal use
interface CSVRow {
  [key: string]: string | number | null;
}

interface SceneTimeInfo {
  [key: string]: { hour: number; minute: number } | null;
}

interface LightInfo {
  name: string;
  values: { [key: string]: number };
}

interface LightsByGroup {
  [key: number]: LightInfo;
}

// Constants
const DEFAULT_LIGHT_NAME = "Đèn chưa đặt tên";
const SCENE_HEADER_KEYWORDS = ["SCENE SETTING"];
const GROUP_COLUMN_KEYWORDS = ["ĐỊA CHỈ", "GROUP"];
const NAME_COLUMN_KEYWORDS = ["TÊN LỘ", "TEN LO"];
const GROUP_NUMBER_REGEX = /GROUP\s*(\d+)/i;

// CSV parser options
const CSV_PARSER_OPTIONS = {
  skipLines: 0,
  headers: false,
  skipComments: true,
};

/**
 * Parse CSV content from template-2 format and convert it to scenes and schedules
 * @param csvContent The CSV file content as string
 * @param separateCabinets Whether to process each cabinet separately
 * @returns Object containing scenes and schedules
 */
export function parseCSVTemplate2(
  csvContent: string,
  separateCabinets: boolean = false
): Promise<{
  scenes: Scene[];
  schedules: Schedule[];
}> {
  return new Promise((resolve, reject) => {
    // Kiểm tra nội dung CSV
    if (!csvContent || csvContent.trim() === "") {
      reject(new Error("CSV content is empty"));
      return;
    }

    try {
      // Tạo một stream từ nội dung CSV
      const stream = Readable.from([csvContent]);
      const results: CSVRow[] = [];

      // Sử dụng csv-parser để parse dữ liệu
      stream
        .pipe(csvParser(CSV_PARSER_OPTIONS))
        .on("data", (data: CSVRow) => results.push(data))
        .on("end", () => {
          try {
            // Kiểm tra kết quả parse
            if (results.length < 5) {
              reject(new Error("CSV file is too short or empty"));
              return;
            }

            // Xử lý dữ liệu đã parse
            const processedData = separateCabinets
              ? processCSVTemplate2WithSeparateCabinets(results)
              : processCSVTemplate2Data(results);

            resolve(processedData);
          } catch (error) {
            // Xử lý lỗi cụ thể và cung cấp thông báo lỗi rõ ràng hơn
            if (error instanceof Error) {
              reject(new Error(`Error processing CSV data: ${error.message}`));
            } else {
              reject(new Error("Unknown error processing CSV data"));
            }
          }
        })
        .on("error", (error) => {
          reject(new Error(`Error parsing CSV: ${error.message}`));
        });
    } catch (error) {
      if (error instanceof Error) {
        reject(new Error(`Error processing CSV: ${error.message}`));
      } else {
        reject(new Error(`Error processing CSV: Unknown error`));
      }
    }
  });
}

/**
 * Tìm hàng chứa thông tin về scene và trích xuất tên scene và thời gian
 * @param rows Dữ liệu CSV đã parse
 * @returns Thông tin về scene và thời gian
 */
function findSceneHeaderAndNames(rows: CSVRow[]): {
  sceneColumns: { [key: string]: number };
  sceneNames: string[];
  sceneTimeInfo: SceneTimeInfo;
} {
  // Tìm hàng chứa thông tin về scene (giới hạn tìm kiếm trong 10 dòng đầu)
  let sceneHeaderRow = -1;
  let sceneNameRow = -1;
  const maxSearchRows = Math.min(10, rows.length);

  for (let i = 0; i < maxSearchRows; i++) {
    const rowValues = Object.values(rows[i]);
    const rowStr = rowValues.join(",").toUpperCase();

    // Kiểm tra các từ khóa scene header
    if (SCENE_HEADER_KEYWORDS.some((keyword) => rowStr.includes(keyword))) {
      sceneHeaderRow = i;
      sceneNameRow = i + 1; // Dòng bên dưới scene setting chứa tên các scene
      break;
    }
  }

  // Xử lý lỗi nếu không tìm thấy scene header
  if (sceneHeaderRow === -1 || sceneNameRow === -1) {
    throw new Error("Could not find scene header row in CSV");
  }

  // Tìm các cột chứa tên scene
  const sceneColumns: { [key: string]: number } = {};
  const sceneNames: string[] = [];
  const sceneTimeInfo: SceneTimeInfo = {};
  const sceneNameRow_data = rows[sceneNameRow];

  // Dòng chứa thông tin thời gian (ngay dưới dòng tên scene)
  const sceneTimeRow = sceneNameRow + 1;
  const hasTimeRow = sceneTimeRow < rows.length;
  const sceneTimeRow_data = hasTimeRow ? rows[sceneTimeRow] : {};

  // Xử lý từng cột trong hàng chứa tên scene
  Object.entries(sceneNameRow_data).forEach(([key, value]) => {
    // Chỉ xử lý các giá trị chuỗi hợp lệ
    if (value && typeof value === "string") {
      const trimmedValue = value.trim();

      if (trimmedValue !== "" && !trimmedValue.includes(":")) {
        const colIndex = parseInt(key);
        sceneColumns[trimmedValue] = colIndex;
        sceneNames.push(trimmedValue);

        // Lấy thông tin thời gian từ dòng bên dưới
        if (hasTimeRow) {
          const timeValue = sceneTimeRow_data[colIndex];
          if (
            timeValue &&
            typeof timeValue === "string" &&
            timeValue.trim() !== ""
          ) {
            // Tìm thời gian trong chuỗi (định dạng HH:MM hoặc H:MM)
            const timeMatch = timeValue.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              const hour = parseInt(timeMatch[1]);
              const minute = parseInt(timeMatch[2]);
              sceneTimeInfo[trimmedValue] = { hour, minute };
            } else {
              sceneTimeInfo[trimmedValue] = null;
            }
          } else {
            sceneTimeInfo[trimmedValue] = null;
          }
        } else {
          sceneTimeInfo[trimmedValue] = null;
        }
      }
    }
  });

  // Xử lý lỗi nếu không tìm thấy tên scene
  if (sceneNames.length === 0) {
    throw new Error("No scene names found in CSV");
  }

  return {
    sceneColumns,
    sceneNames,
    sceneTimeInfo,
  };
}

/**
 * Tìm cột chứa thông tin về group và tên đèn
 * @param rows Dữ liệu CSV đã parse
 * @returns Chỉ số cột chứa thông tin group và tên đèn
 */
function findGroupAndNameColumns(rows: CSVRow[]): {
  groupColumn: number;
  nameColumn: number;
} {
  let groupColumn = -1;
  let nameColumn = -1;
  const maxSearchRows = Math.min(10, rows.length);

  // Tìm kiếm trong 10 dòng đầu tiên
  for (let i = 0; i < maxSearchRows; i++) {
    const row = rows[i];

    // Kiểm tra từng cột trong dòng
    for (const [key, value] of Object.entries(row)) {
      if (!value || typeof value !== "string") continue;

      const valueStr = value.toString().toUpperCase();
      const keyNum = parseInt(key);

      // Kiểm tra từ khóa cột group
      if (GROUP_COLUMN_KEYWORDS.some((keyword) => valueStr.includes(keyword))) {
        groupColumn = keyNum;
      }

      // Kiểm tra từ khóa cột tên đèn
      if (NAME_COLUMN_KEYWORDS.some((keyword) => valueStr.includes(keyword))) {
        nameColumn = keyNum;
      }
    }

    // Nếu đã tìm thấy cột group, dừng tìm kiếm
    if (groupColumn !== -1) {
      break;
    }
  }

  // Xử lý lỗi nếu không tìm thấy cột group
  if (groupColumn === -1) {
    throw new Error("Could not find Group column in CSV");
  }

  return { groupColumn, nameColumn };
}

/**
 * Xử lý dữ liệu đèn từ CSV
 * @param rows Dữ liệu CSV đã parse
 * @param groupColumn Cột chứa thông tin group
 * @param nameColumn Cột chứa thông tin tên đèn
 * @param sceneColumns Map chứa thông tin cột của từng scene
 * @param sceneNames Danh sách tên scene
 * @returns Thông tin đèn đã xử lý
 */
function processLightData(
  rows: CSVRow[],
  groupColumn: number,
  nameColumn: number,
  sceneColumns: { [key: string]: number },
  sceneNames: string[]
): {
  lightsByGroup: LightsByGroup;
} {
  const lightsByGroup: LightsByGroup = {};

  // Hàm helper để lấy thông tin group từ một dòng
  const getGroupInfo = (
    row: CSVRow
  ): { valid: boolean; groupNumber: number } => {
    // Kiểm tra dòng có thông tin group không
    if (
      !row[groupColumn] ||
      !row[groupColumn].toString().toUpperCase().includes("GROUP")
    ) {
      return { valid: false, groupNumber: -1 };
    }

    // Lấy số group
    const groupMatch = row[groupColumn].toString().match(GROUP_NUMBER_REGEX);
    if (!groupMatch) {
      return { valid: false, groupNumber: -1 };
    }

    return { valid: true, groupNumber: parseInt(groupMatch[1]) };
  };

  // Hàm helper để lấy tên đèn từ một dòng
  const getLightName = (row: CSVRow): string => {
    if (
      nameColumn !== -1 &&
      row[nameColumn] &&
      row[nameColumn].toString().trim() !== ""
    ) {
      return row[nameColumn].toString().trim();
    }
    return DEFAULT_LIGHT_NAME;
  };

  // Hàm helper để lấy giá trị độ sáng cho các scene
  const getSceneValues = (row: CSVRow): { [key: string]: number } => {
    const sceneValues: { [key: string]: number } = {};

    sceneNames.forEach((sceneName) => {
      const colIndex = sceneColumns[sceneName];

      if (colIndex !== undefined) {
        const cellValue = row[colIndex];
        sceneValues[sceneName] = convertBrightnessValue(cellValue);
      } else {
        sceneValues[sceneName] = 100; // Giá trị mặc định
      }
    });

    return sceneValues;
  };

  // Xử lý từng dòng để lấy thông tin đèn
  for (const row of rows) {
    const { valid, groupNumber } = getGroupInfo(row);
    if (!valid) continue;

    const lightName = getLightName(row);
    const sceneValues = getSceneValues(row);

    // Lưu thông tin đèn vào map
    lightsByGroup[groupNumber] = {
      name: lightName,
      values: sceneValues,
    };
  }

  return { lightsByGroup };
}

/**
 * Tạo scenes từ dữ liệu đèn đã xử lý
 * @param lightsByGroup Map chứa thông tin đèn theo group
 * @param sceneNames Danh sách tên scene
 * @returns Danh sách scene đã tạo
 */
function createScenes(
  lightsByGroup: LightsByGroup,
  sceneNames: string[]
): Scene[] {
  const scenes: Scene[] = [];

  // Tạo scene cho mỗi tên scene
  sceneNames.forEach((sceneName) => {
    const lights: Light[] = [];

    // Thêm đèn từ mỗi group vào scene
    Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
      const group = parseInt(groupStr);
      const value =
        lightInfo.values[sceneName] !== undefined
          ? lightInfo.values[sceneName]
          : 100;

      lights.push({
        name: lightInfo.name,
        group,
        value,
      });
    });

    // Sắp xếp đèn theo group
    lights.sort((a, b) => a.group - b.group);

    // Tạo scene mới
    const scene: Scene = {
      name: sceneName,
      amount: lights.length,
      lights: [...lights],
      isSequential: false,
    };

    // Kiểm tra xem các group có liên tục không và tất cả đèn có cùng độ sáng không
    const isGroupContinuous = checkContinuousGroups(lights);
    const allSameBrightness =
      lights.length > 0 &&
      lights.every((light) => light.value === lights[0].value);

    if (isGroupContinuous && allSameBrightness && lights.length > 0) {
      // Nếu các group liên tục và tất cả đèn có cùng độ sáng, sử dụng mode group liên tục
      const minGroup = Math.min(...lights.map((light) => light.group));
      scene.isSequential = true;
      scene.startGroup = minGroup;
      scene.lights = [
        {
          name: DEFAULT_LIGHT_NAME,
          group: minGroup,
          value: lights[0].value,
        },
      ];
    }

    scenes.push(scene);
  });

  // Tạo MASTER ON scene
  const masterOnLights: Light[] = [];
  Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
    const group = parseInt(groupStr);
    masterOnLights.push({
      name: lightInfo.name,
      group,
      value: 100,
    });
  });

  // Kiểm tra xem các group có liên tục không
  const isOnGroupContinuous = checkContinuousGroups(masterOnLights);
  const masterOnName = "MASTER ON";

  if (isOnGroupContinuous) {
    // Nếu các group liên tục, sử dụng mode group liên tục
    const minGroup = Math.min(...masterOnLights.map((light) => light.group));
    scenes.push({
      name: masterOnName,
      amount: masterOnLights.length,
      lights: [{ name: DEFAULT_LIGHT_NAME, group: minGroup, value: 100 }],
      isSequential: true,
      startGroup: minGroup,
    });
  } else {
    // Nếu các group không liên tục, sử dụng mode thông thường
    scenes.push({
      name: masterOnName,
      amount: masterOnLights.length,
      lights: masterOnLights,
      isSequential: false,
    });
  }

  // Tạo MASTER OFF scene
  const masterOffLights: Light[] = [];
  Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
    const group = parseInt(groupStr);
    masterOffLights.push({
      name: lightInfo.name,
      group,
      value: 0,
    });
  });

  // Kiểm tra xem các group có liên tục không
  const isOffGroupContinuous = checkContinuousGroups(masterOffLights);
  const masterOffName = "MASTER OFF";

  if (isOffGroupContinuous) {
    // Nếu các group liên tục, sử dụng mode group liên tục
    const minGroup = Math.min(...masterOffLights.map((light) => light.group));
    scenes.push({
      name: masterOffName,
      amount: masterOffLights.length,
      lights: [{ name: DEFAULT_LIGHT_NAME, group: minGroup, value: 0 }],
      isSequential: true,
      startGroup: minGroup,
    });
  } else {
    // Nếu các group không liên tục, sử dụng mode thông thường
    scenes.push({
      name: masterOffName,
      amount: masterOffLights.length,
      lights: masterOffLights,
      isSequential: false,
    });
  }

  return scenes;
}

/**
 * Tạo schedules từ danh sách scenes và thông tin thời gian
 * Trong chế độ tủ riêng, tạo một schedule duy nhất cho mỗi loại scene (cùng tên cơ bản)
 * @param scenes Danh sách scenes
 * @param sceneTimeInfo Thông tin thời gian của các scene
 * @returns Danh sách schedules
 */
function createSchedulesFromScenesWithTime(
  scenes: Scene[],
  sceneTimeInfo: SceneTimeInfo
): Schedule[] {
  const schedules: Schedule[] = [];

  // Tạo map để nhóm các scene theo tên cơ bản (không bao gồm tên tủ)
  // Ví dụ: "DAY TIME (DMX-LT-GYM)" và "DAY TIME (DMX-LT-BR1)" sẽ được nhóm vào cùng một key "DAY TIME"
  const sceneGroups: { [key: string]: number[] } = {};

  // Tạo map để lưu trữ thông tin thời gian theo tên cơ bản của scene
  const baseSceneTimeInfo: {
    [key: string]: { hour: number; minute: number } | null;
  } = {};

  // Xử lý từng scene để nhóm theo tên cơ bản
  scenes.forEach((scene, index) => {
    // Lấy tên cơ bản của scene bằng cách loại bỏ phần tên tủ trong ngoặc đơn
    // Ví dụ: "DAY TIME (DMX-LT-GYM)" -> "DAY TIME"
    const baseSceneName = scene.name.replace(/\s+\([^)]+\)$/, "");

    // Khởi tạo mảng nếu chưa tồn tại
    if (!sceneGroups[baseSceneName]) {
      sceneGroups[baseSceneName] = [];

      // Tìm thông tin thời gian cho tên cơ bản này
      // Kiểm tra theo thứ tự ưu tiên:
      // 1. Tên chính xác
      // 2. Tên cơ bản là tiền tố của tên thời gian
      // 3. Tên thời gian là tiền tố của tên cơ bản

      // Kiểm tra tên chính xác trước
      if (sceneTimeInfo[baseSceneName]) {
        baseSceneTimeInfo[baseSceneName] = sceneTimeInfo[baseSceneName];
      } else {
        // Nếu không tìm thấy tên chính xác, thử các phương pháp khác
        let found = false;

        // Kiểm tra tên cơ bản là tiền tố của tên thời gian
        for (const [timeSceneName, timeInfo] of Object.entries(sceneTimeInfo)) {
          if (timeSceneName.startsWith(baseSceneName)) {
            baseSceneTimeInfo[baseSceneName] = timeInfo;

            found = true;
            break;
          }
        }

        // Nếu vẫn không tìm thấy, kiểm tra tên thời gian là tiền tố của tên cơ bản
        if (!found) {
          for (const [timeSceneName, timeInfo] of Object.entries(
            sceneTimeInfo
          )) {
            if (baseSceneName.startsWith(timeSceneName)) {
              baseSceneTimeInfo[baseSceneName] = timeInfo;

              break;
            }
          }
        }
      }
    }

    // Thêm index của scene vào nhóm tương ứng (1-based index)
    sceneGroups[baseSceneName].push(index + 1);
  });

  // Tạo schedules cho các scene có thông tin thời gian
  // Mỗi schedule sẽ bao gồm tất cả các scene cùng loại từ tất cả các tủ
  Object.entries(sceneGroups).forEach(([baseSceneName, sceneIndices]) => {
    // Lấy thông tin thời gian cho tên cơ bản này
    const timeInfo = baseSceneTimeInfo[baseSceneName];

    // Bỏ qua nếu không có thông tin thời gian
    if (!timeInfo) return;

    // Tạo schedule mới với tất cả các scene cùng loại từ tất cả các tủ
    schedules.push({
      name: `Schedule ${baseSceneName}`,
      enable: true,
      sceneAmount: sceneIndices.length,
      sceneGroup: sceneIndices, // Bao gồm tất cả các scene cùng loại từ tất cả các tủ
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true,
      hour: timeInfo.hour,
      minute: timeInfo.minute,
    });
  });

  return schedules;
}

/**
 * Xử lý dữ liệu CSV đã parse cho template-2
 */
function processCSVTemplate2Data(rows: CSVRow[]): {
  scenes: Scene[];
  schedules: Schedule[];
} {
  if (rows.length < 5) {
    throw new Error("CSV file is too short or empty");
  }

  // Tìm thông tin về scene
  const { sceneNames, sceneColumns, sceneTimeInfo } =
    findSceneHeaderAndNames(rows);

  // Tìm cột chứa thông tin về group và tên đèn
  const { groupColumn, nameColumn } = findGroupAndNameColumns(rows);

  // Xử lý dữ liệu đèn
  const { lightsByGroup } = processLightData(
    rows,
    groupColumn,
    nameColumn,
    sceneColumns,
    sceneNames
  );

  // Tạo scenes
  const scenes = createScenes(lightsByGroup, sceneNames);

  // Tạo schedules dựa trên thông tin thời gian
  const schedules: Schedule[] = createSchedulesFromScenesWithTime(
    scenes,
    sceneTimeInfo
  );

  return { scenes, schedules };
}

/**
 * Tìm tất cả các header của tủ điện trong CSV cho template-2
 * @param rows Dữ liệu CSV đã parse
 * @returns Danh sách header của tủ điện
 */
function findCabinetHeaders(
  rows: CSVRow[]
): { name: string; startRow: number }[] {
  const cabinetHeaders: { name: string; startRow: number }[] = [];
  const CABINET_HEADER_KEYWORDS = ["TỦ ĐIỆN", "TU DIEN"];
  const DEFAULT_CABINET_NAME = "Tủ không tên";

  // Tìm dòng chứa từ khóa "TỦ ĐIỆN" để xác định vị trí bắt đầu
  let headerRow = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const rowValues = Object.values(row);
    const rowStr = rowValues.join(",").toUpperCase();

    if (CABINET_HEADER_KEYWORDS.some((keyword) => rowStr.includes(keyword))) {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) {
    return cabinetHeaders;
  }

  // Tìm dòng chứa thông tin về scene để xác định vị trí của dòng thời gian
  let sceneHeaderRow = -1;
  const SCENE_HEADER_KEYWORDS = ["SCENE SETTING"];

  for (let i = headerRow; i < Math.min(headerRow + 10, rows.length); i++) {
    const rowValues = Object.values(rows[i]);
    const rowStr = rowValues.join(",").toUpperCase();

    if (SCENE_HEADER_KEYWORDS.some((keyword) => rowStr.includes(keyword))) {
      sceneHeaderRow = i;
      break;
    }
  }

  if (sceneHeaderRow === -1) {
    return cabinetHeaders;
  }

  // Dòng tên scene và dòng thời gian
  const sceneNameRow = sceneHeaderRow + 1;
  const timeRow = sceneNameRow + 1;

  // Tìm tủ đầu tiên: dòng sau dòng thời gian và trước dòng group đầu tiên
  let firstCabinetRow = -1;
  let firstCabinetName = DEFAULT_CABINET_NAME;

  for (let i = timeRow + 1; i < rows.length; i++) {
    const row = rows[i];
    const firstColumnValue = row[0];

    if (
      firstColumnValue &&
      typeof firstColumnValue === "string" &&
      firstColumnValue.trim() !== ""
    ) {
      // Kiểm tra xem dòng này có phải là dòng group không
      const isGroupRow = Object.values(row).some(
        (value) =>
          value &&
          typeof value === "string" &&
          value.toString().toUpperCase().includes("GROUP")
      );

      if (!isGroupRow) {
        firstCabinetRow = i;
        firstCabinetName = firstColumnValue.trim();
        break;
      }
    }
  }

  if (firstCabinetRow !== -1) {
    cabinetHeaders.push({
      name: firstCabinetName,
      startRow: firstCabinetRow,
    });

    // Tìm các tủ tiếp theo: dòng chỉ có giá trị ở cột đầu tiên
    for (let i = firstCabinetRow + 1; i < rows.length; i++) {
      const row = rows[i];
      const firstColumnValue = row[0];

      // Kiểm tra xem dòng này có phải là dòng tên tủ không
      if (
        firstColumnValue &&
        typeof firstColumnValue === "string" &&
        firstColumnValue.trim() !== ""
      ) {
        // Kiểm tra xem các cột khác có trống không
        let otherColumnsEmpty = true;
        for (let j = 1; j < 5; j++) {
          // Chỉ kiểm tra vài cột đầu tiên
          const cellValue = row[j];
          if (
            cellValue &&
            typeof cellValue === "string" &&
            cellValue.trim() !== ""
          ) {
            otherColumnsEmpty = false;
            break;
          }
        }

        // Nếu các cột khác trống và không phải dòng group, đây là tên tủ mới
        if (
          otherColumnsEmpty &&
          !firstColumnValue.toString().toUpperCase().includes("GROUP")
        ) {
          cabinetHeaders.push({
            name: firstColumnValue.trim(),
            startRow: i,
          });
        }
      }
    }
  }

  return cabinetHeaders;
}

/**
 * Xử lý dữ liệu CSV đã parse với chế độ tủ riêng biệt cho template-2
 */
function processCSVTemplate2WithSeparateCabinets(rows: CSVRow[]): {
  scenes: Scene[];
  schedules: Schedule[];
} {
  if (rows.length < 5) {
    throw new Error("CSV file is too short or empty");
  }

  // Tìm thông tin về scene từ toàn bộ file (chỉ tìm một lần)
  const { sceneNames, sceneColumns, sceneTimeInfo } =
    findSceneHeaderAndNames(rows);

  // Tìm cột chứa thông tin về group và tên đèn từ toàn bộ file
  const { groupColumn, nameColumn } = findGroupAndNameColumns(rows);

  // Tìm tất cả các header của tủ điện
  const cabinetHeaders = findCabinetHeaders(rows);

  if (cabinetHeaders.length === 0) {
    throw new Error("Không tìm thấy thông tin tủ điện trong file CSV");
  }

  // Xác định phạm vi dữ liệu cho mỗi tủ
  const cabinets = cabinetHeaders.map((header, index) => {
    const endRow =
      index < cabinetHeaders.length - 1
        ? cabinetHeaders[index + 1].startRow - 1
        : rows.length - 1;

    return {
      name: header.name,
      startRow: header.startRow,
      endRow: endRow,
    };
  });

  // Mảng để lưu tất cả các scene
  const allScenes: Scene[] = [];

  // Mảng để lưu thông tin thời gian của các scene
  const allSceneTimeInfo: SceneTimeInfo = {};

  // Xử lý từng tủ
  cabinets.forEach((cabinet) => {
    const cabinetRows = rows.slice(cabinet.startRow, cabinet.endRow + 1);

    try {
      // Lọc ra các dòng chứa thông tin đèn (có chứa từ "GROUP")
      const lightRows = cabinetRows.filter((row) => {
        const rowValues = Object.values(row);
        const rowStr = rowValues.join(",").toUpperCase();
        return rowStr.includes("GROUP");
      });

      // Xử lý dữ liệu đèn - chỉ sử dụng các dòng chứa thông tin đèn
      const { lightsByGroup } = processLightData(
        lightRows,
        groupColumn,
        nameColumn,
        sceneColumns,
        sceneNames
      );

      // Tạo scenes cho tủ hiện tại với tên bao gồm tên tủ
      sceneNames.forEach((sceneName) => {
        const lights: Light[] = [];

        // Thêm đèn từ mỗi group vào scene
        Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
          const group = parseInt(groupStr);
          const value =
            lightInfo.values[sceneName] !== undefined
              ? lightInfo.values[sceneName]
              : 100;

          lights.push({
            name: lightInfo.name,
            group,
            value,
          });
        });

        // Sắp xếp đèn theo group
        lights.sort((a, b) => a.group - b.group);

        // Tạo scene mới với tên bao gồm tên tủ đầy đủ trong ngoặc đơn
        const sceneNameWithCabinet = `${sceneName} (${cabinet.name})`;
        const scene: Scene = {
          name: sceneNameWithCabinet,
          amount: lights.length,
          lights: [...lights],
          isSequential: false,
        };

        // Lưu thông tin thời gian cho scene này
        if (sceneTimeInfo[sceneName]) {
          allSceneTimeInfo[sceneNameWithCabinet] = sceneTimeInfo[sceneName];
        }

        // Kiểm tra xem các group có liên tục không và tất cả đèn có cùng độ sáng không
        const isGroupContinuous = checkContinuousGroups(lights);
        const allSameBrightness =
          lights.length > 0 &&
          lights.every((light) => light.value === lights[0].value);

        if (isGroupContinuous && allSameBrightness && lights.length > 0) {
          // Nếu các group liên tục và tất cả đèn có cùng độ sáng, sử dụng mode group liên tục
          const minGroup = Math.min(...lights.map((light) => light.group));
          scene.isSequential = true;
          scene.startGroup = minGroup;
          scene.lights = [
            {
              name: DEFAULT_LIGHT_NAME,
              group: minGroup,
              value: lights[0].value,
            },
          ];
        }

        allScenes.push(scene);
      });

      // Tạo MASTER ON/OFF cho mỗi tủ
      // Tạo MASTER ON scene
      const masterOnLights: Light[] = [];
      Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
        const group = parseInt(groupStr);
        masterOnLights.push({
          name: lightInfo.name,
          group,
          value: 100,
        });
      });

      // Kiểm tra xem các group có liên tục không
      const isOnGroupContinuous = checkContinuousGroups(masterOnLights);
      // Thêm tên tủ vào tên scene MASTER ON
      const masterOnName = `MASTER ON (${cabinet.name})`;

      if (isOnGroupContinuous) {
        // Nếu các group liên tục, sử dụng mode group liên tục
        const minGroup = Math.min(
          ...masterOnLights.map((light) => light.group)
        );
        allScenes.push({
          name: masterOnName,
          amount: masterOnLights.length,
          lights: [{ name: DEFAULT_LIGHT_NAME, group: minGroup, value: 100 }],
          isSequential: true,
          startGroup: minGroup,
        });
      } else {
        // Nếu các group không liên tục, sử dụng mode thông thường
        allScenes.push({
          name: masterOnName,
          amount: masterOnLights.length,
          lights: masterOnLights,
          isSequential: false,
        });
      }

      // Tạo MASTER OFF scene
      const masterOffLights: Light[] = [];
      Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
        const group = parseInt(groupStr);
        masterOffLights.push({
          name: lightInfo.name,
          group,
          value: 0,
        });
      });

      // Kiểm tra xem các group có liên tục không
      const isOffGroupContinuous = checkContinuousGroups(masterOffLights);
      // Thêm tên tủ vào tên scene MASTER OFF
      const masterOffName = `MASTER OFF (${cabinet.name})`;

      if (isOffGroupContinuous) {
        // Nếu các group liên tục, sử dụng mode group liên tục
        const minGroup = Math.min(
          ...masterOffLights.map((light) => light.group)
        );
        allScenes.push({
          name: masterOffName,
          amount: masterOffLights.length,
          lights: [{ name: DEFAULT_LIGHT_NAME, group: minGroup, value: 0 }],
          isSequential: true,
          startGroup: minGroup,
        });
      } else {
        // Nếu các group không liên tục, sử dụng mode thông thường
        allScenes.push({
          name: masterOffName,
          amount: masterOffLights.length,
          lights: masterOffLights,
          isSequential: false,
        });
      }
    } catch (error) {
      console.error(`Error processing cabinet ${cabinet.name}:`, error);
    }
  });

  // Tạo schedules dựa trên thông tin thời gian
  const schedules: Schedule[] = createSchedulesFromScenesWithTime(
    allScenes,
    allSceneTimeInfo
  );

  return { scenes: allScenes, schedules };
}
