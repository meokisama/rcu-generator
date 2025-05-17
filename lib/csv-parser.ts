import { Light, Scene, Schedule } from "@/types/app-types";
import csvParser from "csv-parser";
import { Readable } from "stream";

// Types for internal use
interface SceneTimeInfo {
  [key: string]: { hour: number; minute: number };
}

interface LightInfo {
  name: string;
  values: { [key: string]: number };
}

interface LightsByGroup {
  [key: number]: LightInfo;
}

interface OpenCloseLights {
  [key: string]: { open: Light[]; close: Light[] };
}

// Define a more specific type for CSV row data
interface CSVRow {
  [key: string]: string | number | null;
}

// Common scene processing result type
interface SceneProcessingResult {
  scenes: Scene[];
}

/**
 * Kiểm tra xem các group có liên tục không và tất cả đèn có cùng độ sáng không
 * @param lights Danh sách đèn cần kiểm tra
 * @returns true nếu các group liên tục và tất cả đèn có cùng độ sáng, false nếu không
 */
function checkContinuousGroups(lights: Light[]): boolean {
  if (lights.length <= 1) return true;

  // Tìm giá trị độ sáng đầu tiên và kiểm tra xem tất cả đèn có cùng độ sáng không
  const firstValue = lights[0].value;

  // Tìm giá trị group nhỏ nhất và lớn nhất
  let minGroup = lights[0].group;
  let maxGroup = lights[0].group;

  // Kiểm tra độ sáng và tìm min/max group trong một lần duyệt
  for (let i = 1; i < lights.length; i++) {
    // Kiểm tra độ sáng
    if (lights[i].value !== firstValue) {
      return false;
    }

    // Cập nhật min/max group
    if (lights[i].group < minGroup) {
      minGroup = lights[i].group;
    } else if (lights[i].group > maxGroup) {
      maxGroup = lights[i].group;
    }
  }

  // Kiểm tra xem số lượng đèn có bằng với khoảng group không
  // Nếu bằng thì các group liên tục và không trùng lặp
  return lights.length === maxGroup - minGroup + 1;
}

// Cached regular expressions
const PERCENT_REGEX = /%/g;

/**
 * Chuyển đổi giá trị độ sáng từ nhiều định dạng khác nhau sang số
 * @param value Giá trị độ sáng cần chuyển đổi
 * @returns Giá trị độ sáng dạng số (0-100)
 */
function convertBrightnessValue(
  value: string | number | null | undefined
): number {
  // Giá trị mặc định là 100
  const DEFAULT_BRIGHTNESS = 100;

  // Nếu giá trị không tồn tại hoặc là chuỗi rỗng, trả về giá trị mặc định
  if (value === undefined || value === null || value === "") {
    return DEFAULT_BRIGHTNESS;
  }

  // Chuyển đổi thành chuỗi và cắt khoảng trắng
  const strValue = value.toString().trim().toLowerCase();

  // Xử lý các trường hợp đặc biệt
  if (strValue === "on" || strValue === "on/off") {
    return 100;
  }

  if (strValue === "off") {
    return 0;
  }

  // Loại bỏ dấu phần trăm và xử lý chuỗi rỗng
  const cleanValue = strValue.replace(PERCENT_REGEX, "");
  if (cleanValue === "") {
    return DEFAULT_BRIGHTNESS;
  }

  // Chuyển đổi thành số và kiểm tra giá trị hợp lệ
  const brightness = parseInt(cleanValue);
  if (!isNaN(brightness) && brightness >= 0 && brightness <= 100) {
    return brightness;
  }

  // Trả về giá trị mặc định nếu không hợp lệ
  return DEFAULT_BRIGHTNESS;
}

// Cached regular expressions
const SCENE_HEADER_KEYWORDS = ["SCENE SETTING", "SCENE OVERIDE"];

/**
 * Tìm hàng chứa thông tin về scene và trích xuất tên scene và thông tin thời gian
 * @param rows Dữ liệu CSV đã parse
 * @param cabinetName Tên tủ (tùy chọn, dùng cho thông báo lỗi)
 * @returns Thông tin về scene và thời gian
 */
function findSceneHeaderAndNames(
  rows: CSVRow[],
  cabinetName?: string
): {
  sceneHeaderRow: number;
  sceneNameRow: number;
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
      sceneNameRow = i + 1;
      break;
    }
  }

  // Xử lý lỗi nếu không tìm thấy scene header
  if (sceneHeaderRow === -1 || sceneNameRow === -1) {
    const errorMsg = cabinetName
      ? `Không tìm thấy thông tin scene trong tủ ${cabinetName}`
      : "Could not find scene header row in CSV";
    throw new Error(errorMsg);
  }

  // Tìm các cột chứa tên scene
  const sceneColumns: { [key: string]: number } = {};
  const sceneNames: string[] = [];
  const sceneTimeInfo: SceneTimeInfo = {}; // Giữ lại để tương thích với interface
  const sceneNameRow_data = rows[sceneNameRow];

  // Xử lý từng cột trong hàng chứa tên scene
  Object.entries(sceneNameRow_data).forEach(([key, value]) => {
    // Chỉ xử lý các giá trị chuỗi hợp lệ
    if (value && typeof value === "string") {
      const trimmedValue = value.trim();

      if (trimmedValue !== "" && !trimmedValue.includes(":")) {
        // Bỏ qua các scene có tên bắt đầu bằng "OPEN" hoặc "CLOSE"
        const upperValue = trimmedValue.toUpperCase();
        if (upperValue.startsWith("OPEN") || upperValue.startsWith("CLOSE")) {
          return;
        }

        const colIndex = parseInt(key);
        sceneColumns[trimmedValue] = colIndex;
        sceneNames.push(trimmedValue);
      }
    }
  });

  // Xử lý lỗi nếu không tìm thấy tên scene
  if (sceneNames.length === 0) {
    const noScenesErrorMsg = cabinetName
      ? `Không tìm thấy tên scene trong tủ ${cabinetName}`
      : "No scene names found in CSV";
    throw new Error(noScenesErrorMsg);
  }

  return {
    sceneHeaderRow,
    sceneNameRow,
    sceneColumns,
    sceneNames,
    sceneTimeInfo,
  };
}

// Cached column header keywords
const GROUP_COLUMN_KEYWORDS = ["GROUP", "ĐỊA CHỈ"];
const NAME_COLUMN_KEYWORDS = ["TÊN LỘ", "TEN LO"];

/**
 * Tìm cột chứa thông tin về group và tên đèn
 * @param rows Dữ liệu CSV đã parse
 * @param cabinetName Tên tủ (tùy chọn, dùng cho thông báo lỗi)
 * @returns Chỉ số cột chứa thông tin group và tên đèn
 */
function findGroupAndNameColumns(
  rows: CSVRow[],
  cabinetName?: string
): {
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
    const errorMsg = cabinetName
      ? `Không tìm thấy cột Group trong tủ ${cabinetName}`
      : "Could not find Group column in CSV";
    throw new Error(errorMsg);
  }

  return { groupColumn, nameColumn };
}

// Cached regular expressions
const GROUP_NUMBER_REGEX = /GROUP\s*(\d+)/i;
const OPEN_CLOSE_NUMBER_REGEX = /\d+/;
const DEFAULT_LIGHT_NAME = "Đèn chưa đặt tên";

/**
 * Xử lý dữ liệu đèn từ CSV
 * @param rows Dữ liệu CSV đã parse
 * @param groupColumn Cột chứa thông tin group
 * @param nameColumn Cột chứa thông tin tên đèn
 * @param sceneColumns Map giữa tên scene và cột chứa giá trị độ sáng
 * @param sceneNames Danh sách tên scene
 * @returns Thông tin về đèn đã xử lý
 */
function processLightData(
  rows: CSVRow[],
  groupColumn: number,
  nameColumn: number,
  sceneColumns: { [key: string]: number },
  sceneNames: string[]
): {
  lightsByGroup: LightsByGroup;
  openCloseLightsByNumber: OpenCloseLights;
  openCloseGroups: Set<number>;
  groupCounts: { [key: number]: number };
} {
  // Khởi tạo các cấu trúc dữ liệu kết quả
  const lightsByGroup: LightsByGroup = {};
  const openCloseLightsByNumber: OpenCloseLights = {};
  const openCloseGroups = new Set<number>();
  const groupCounts: { [key: number]: number } = {};

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

  // Bước 1: Đếm số lần xuất hiện của mỗi group (không bao gồm OPEN/CLOSE)
  for (const row of rows) {
    const { valid, groupNumber } = getGroupInfo(row);
    if (!valid) continue;

    const lightName = getLightName(row);

    // Kiểm tra xem đèn có phải là OPEN hoặc CLOSE không
    const isOpenOrCloseLight =
      lightName.toUpperCase().startsWith("OPEN") ||
      lightName.toUpperCase().startsWith("CLOSE");

    // Không đếm đèn OPEN/CLOSE
    if (!isOpenOrCloseLight) {
      groupCounts[groupNumber] = (groupCounts[groupNumber] || 0) + 1;
    }
  }

  // Bước 2: Xử lý từng dòng để lấy thông tin đèn
  for (const row of rows) {
    const { valid, groupNumber } = getGroupInfo(row);
    if (!valid) continue;

    const groupName = `Group ${groupNumber}`;
    const lightName = getLightName(row);

    // Kiểm tra xem đèn có phải là OPEN hoặc CLOSE không
    const isOpenLight = lightName.toUpperCase().startsWith("OPEN");
    const isCloseLight = lightName.toUpperCase().startsWith("CLOSE");
    const isOpenOrCloseLight = isOpenLight || isCloseLight;

    // Lấy giá trị độ sáng cho từng scene
    const sceneValues = getSceneValues(row);

    // Xử lý đèn OPEN/CLOSE
    if (isOpenOrCloseLight) {
      // Xác định số của OPEN/CLOSE (ví dụ: OPEN 1 -> 1)
      const match = lightName.match(OPEN_CLOSE_NUMBER_REGEX);
      if (!match) continue;

      const openCloseNumber = match[0];

      // Khởi tạo cấu trúc lưu trữ nếu chưa tồn tại
      if (!openCloseLightsByNumber[openCloseNumber]) {
        openCloseLightsByNumber[openCloseNumber] = {
          open: [],
          close: [],
        };
      }

      // Thêm đèn vào danh sách tương ứng (open hoặc close)
      const light: Light = {
        name: lightName,
        group: groupNumber,
        value: 100, // Giá trị mặc định, sẽ được điều chỉnh khi tạo scene
      };

      if (isOpenLight) {
        openCloseLightsByNumber[openCloseNumber].open.push(light);
      } else {
        openCloseLightsByNumber[openCloseNumber].close.push(light);
      }

      // Thêm group vào danh sách các group đèn OPEN/CLOSE
      openCloseGroups.add(groupNumber);
    } else {
      // Kiểm tra xem group có trùng lặp không
      const isDuplicateGroup = groupCounts[groupNumber] > 1;

      // Kiểm tra xem đèn này có giá trị độ sáng không
      const hasAnyBrightnessValue = Object.values(sceneValues).some(
        (value) => value !== 100 // Nếu khác 100 (giá trị mặc định), tức là có giá trị độ sáng
      );

      // Kiểm tra xem đã có đèn với group này chưa
      const existingLight = lightsByGroup[groupNumber];

      // Nếu chưa có đèn với group này, hoặc đèn mới có giá trị độ sáng và đèn cũ không có
      if (
        !existingLight ||
        (hasAnyBrightnessValue &&
          !Object.values(existingLight.values).some((value) => value !== 100))
      ) {
        // Lưu thông tin đèn thông thường theo group (không phải OPEN/CLOSE)
        lightsByGroup[groupNumber] = {
          // Nếu group trùng lặp, sử dụng tên group, ngược lại sử dụng tên đèn gốc
          name: isDuplicateGroup ? groupName : lightName,
          values: sceneValues,
        };
      }
    }
  }

  return {
    lightsByGroup,
    openCloseLightsByNumber,
    openCloseGroups,
    groupCounts,
  };
}

/**
 * Tạo scene MASTER ON và MASTER OFF
 * @param allLights Danh sách tất cả đèn
 * @param cabinetName Tên tủ (tùy chọn)
 * @returns Danh sách scene MASTER ON và MASTER OFF
 */
function createMasterScenes(allLights: Light[], cabinetName?: string): Scene[] {
  const scenes: Scene[] = [];

  if (allLights.length === 0) {
    return scenes;
  }

  // Sử dụng tên đầy đủ của tủ trong ngoặc đơn (ví dụ: (DMX-LT-GYM))
  let cabinetSuffix = "";
  if (cabinetName) {
    cabinetSuffix = ` (${cabinetName})`;
  }

  // Tạo scene MASTER ON
  const masterOnLights = allLights.map((light) => ({
    ...light,
    value: 100, // Tất cả đèn có độ sáng 100%
  }));

  // Kiểm tra xem các group có liên tục không
  const isOnGroupContinuous = checkContinuousGroups(masterOnLights);
  const masterOnName = `MASTER ON${cabinetSuffix}`;

  if (isOnGroupContinuous) {
    // Nếu các group liên tục, sử dụng mode group liên tục
    const minGroup = Math.min(...masterOnLights.map((light) => light.group));
    scenes.push({
      name: masterOnName,
      amount: masterOnLights.length,
      lights: [{ name: "Đèn chưa đặt tên", group: minGroup, value: 100 }],
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

  // Tạo scene MASTER OFF
  const masterOffLights = allLights.map((light) => ({
    ...light,
    value: 0, // Tất cả đèn có độ sáng 0%
  }));

  // Kiểm tra xem các group có liên tục không
  const isOffGroupContinuous = checkContinuousGroups(masterOffLights);
  const masterOffName = `MASTER OFF${cabinetSuffix}`;

  if (isOffGroupContinuous) {
    // Nếu các group liên tục, sử dụng mode group liên tục
    const minGroup = Math.min(...masterOffLights.map((light) => light.group));
    scenes.push({
      name: masterOffName,
      amount: masterOffLights.length,
      lights: [{ name: "Đèn chưa đặt tên", group: minGroup, value: 0 }],
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
 * Tạo các scene OPEN/CLOSE
 * @param openCloseLightsByNumber Thông tin đèn OPEN/CLOSE
 * @param cabinetName Tên tủ (tùy chọn)
 * @returns Danh sách scene OPEN/CLOSE
 */
function createOpenCloseScenes(
  openCloseLightsByNumber: OpenCloseLights,
  cabinetName?: string
): Scene[] {
  const scenes: Scene[] = [];

  // Sử dụng tên đầy đủ của tủ trong ngoặc đơn (ví dụ: (DMX-LT-GYM))
  let cabinetSuffix = "";
  if (cabinetName) {
    cabinetSuffix = ` (${cabinetName})`;
  }

  Object.entries(openCloseLightsByNumber).forEach(([number, lightsObj]) => {
    // Kiểm tra xem có cả đèn OPEN và CLOSE không
    const hasOpenLights = lightsObj.open.length > 0;
    const hasCloseLights = lightsObj.close.length > 0;

    // Chỉ tạo scene OPEN nếu có ít nhất một đèn OPEN hoặc CLOSE
    if (hasOpenLights || hasCloseLights) {
      // Tạo danh sách đèn cho scene OPEN
      const openSceneLights: Light[] = [];

      // Thêm đèn OPEN với độ sáng 100%
      if (hasOpenLights) {
        lightsObj.open.forEach((light) => {
          openSceneLights.push({
            ...light,
            value: 100, // Đèn OPEN sáng 100% trong scene OPEN
          });
        });
      }

      // Thêm đèn CLOSE với độ sáng 0%
      if (hasCloseLights) {
        lightsObj.close.forEach((light) => {
          openSceneLights.push({
            ...light,
            value: 0, // Đèn CLOSE tắt (0%) trong scene OPEN
          });
        });
      }

      // Sắp xếp đèn theo group
      openSceneLights.sort((a, b) => a.group - b.group);

      // Thêm scene OPEN mới
      if (openSceneLights.length > 0) {
        const openName = `OPEN ${number}${cabinetSuffix}`;
        scenes.push({
          name: openName,
          amount: openSceneLights.length,
          lights: openSceneLights,
          isSequential: false,
        });
      }

      // Tạo danh sách đèn cho scene CLOSE
      const closeSceneLights: Light[] = [];

      // Thêm đèn OPEN với độ sáng 0%
      if (hasOpenLights) {
        lightsObj.open.forEach((light) => {
          closeSceneLights.push({
            ...light,
            value: 0, // Đèn OPEN tắt (0%) trong scene CLOSE
          });
        });
      }

      // Thêm đèn CLOSE với độ sáng 100%
      if (hasCloseLights) {
        lightsObj.close.forEach((light) => {
          closeSceneLights.push({
            ...light,
            value: 100, // Đèn CLOSE sáng 100% trong scene CLOSE
          });
        });
      }

      // Sắp xếp đèn theo group
      closeSceneLights.sort((a, b) => a.group - b.group);

      // Thêm scene CLOSE mới
      if (closeSceneLights.length > 0) {
        const closeName = `CLOSE ${number}${cabinetSuffix}`;
        scenes.push({
          name: closeName,
          amount: closeSceneLights.length,
          lights: closeSceneLights,
          isSequential: false,
        });
      }
    }
  });

  return scenes;
}

/**
 * Cấu hình CSV parser
 */
const CSV_PARSER_OPTIONS = {
  skipLines: 0,
  headers: false,
  skipComments: true,
};

/**
 * Parse CSV content and convert it to scenes and schedules
 * @param csvContent The CSV file content as string
 * @param separateCabinets Whether to process each cabinet separately
 * @returns Object containing scenes and schedules
 */
export function parseCSV(
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
              ? processCSVDataWithSeparateCabinets(results)
              : processCSVData(results);

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
        reject(new Error(`Error initializing CSV parser: ${error.message}`));
      } else {
        reject(new Error("Unknown error initializing CSV parser"));
      }
    }
  });
}

/**
 * Tạo scenes từ dữ liệu đèn đã xử lý
 * @param lightsByGroup Thông tin đèn theo group
 * @param openCloseGroups Danh sách group đèn OPEN/CLOSE
 * @param sceneNames Danh sách tên scene
 * @returns Danh sách scene đã tạo
 */
function createScenesFromLightData(
  lightsByGroup: LightsByGroup,
  openCloseGroups: Set<number>,
  sceneNames: string[]
): Scene[] {
  const scenes: Scene[] = [];

  // Tạo scene cho mỗi tên scene
  sceneNames.forEach((sceneName) => {
    const lights: Light[] = [];

    // Thêm đèn từ mỗi group vào scene (trừ đèn OPEN/CLOSE)
    Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
      const group = parseInt(groupStr);

      // Bỏ qua các đèn thuộc group OPEN/CLOSE
      if (openCloseGroups.has(group)) {
        return;
      }

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

    if (isGroupContinuous && lights.length > 0) {
      // Nếu các group liên tục và tất cả đèn có cùng độ sáng, sử dụng mode group liên tục
      const minGroup = Math.min(...lights.map((light) => light.group));
      scene.isSequential = true;
      scene.startGroup = minGroup;
      scene.lights = [
        {
          name: "Đèn chưa đặt tên",
          group: minGroup,
          value: lights[0].value,
        },
      ];
    }

    scenes.push(scene);
  });

  return scenes;
}

/**
 * Hàm chung để xử lý dữ liệu CSV và tạo scenes
 * @param rows Dữ liệu CSV đã parse
 * @param cabinetName Tên tủ (tùy chọn)
 * @returns Kết quả xử lý scene
 */
function processCSVDataCommon(
  rows: CSVRow[],
  cabinetName?: string
): SceneProcessingResult {
  // Tìm thông tin về scene
  const { sceneNames, sceneColumns } = findSceneHeaderAndNames(
    rows,
    cabinetName
  );

  // Tìm cột chứa thông tin về group và tên đèn
  const { groupColumn, nameColumn } = findGroupAndNameColumns(
    rows,
    cabinetName
  );

  // Xử lý dữ liệu đèn
  const { lightsByGroup, openCloseLightsByNumber, openCloseGroups } =
    processLightData(rows, groupColumn, nameColumn, sceneColumns, sceneNames);

  // Kiểm tra xem có scene chứa MASTER ON/OFF không
  const masterOnOffIndex = sceneNames.findIndex((name) => {
    const upperName = name.toUpperCase();
    return (
      upperName.includes("MASTER ON/OFF") ||
      upperName.includes("MASTER ON-OFF") ||
      upperName.includes("MASTER ON OFF")
    );
  });

  // Tạo danh sách tất cả các đèn (không bao gồm OPEN/CLOSE)
  const allLights: Light[] = [];

  // Thêm đèn từ lightsByGroup (không bao gồm OPEN/CLOSE)
  Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
    const group = parseInt(groupStr);

    // Bỏ qua các đèn thuộc group OPEN/CLOSE
    if (openCloseGroups.has(group)) {
      return;
    }

    allLights.push({
      name: lightInfo.name,
      group,
      value: 100, // Giá trị mặc định, sẽ được thay đổi sau
    });
  });

  // Sắp xếp tất cả đèn theo group
  allLights.sort((a, b) => a.group - b.group);

  // Tạo danh sách scene thông thường (không bao gồm MASTER ON/OFF)
  const regularSceneNames = sceneNames.filter(
    (_, index) => index !== masterOnOffIndex
  );

  // Tạo scenes thông thường
  let scenes: Scene[] = [];

  // Nếu có tên tủ, tạo scenes với tên bao gồm tên tủ
  if (cabinetName) {
    // Sử dụng tên đầy đủ của tủ (ví dụ: DMX-LT-GYM)
    // Tạo scenes thông thường với tên bao gồm tên tủ
    regularSceneNames.forEach((sceneName) => {
      const lights: Light[] = [];

      // Thêm đèn từ mỗi group vào scene (trừ đèn OPEN/CLOSE)
      Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
        const group = parseInt(groupStr);

        // Bỏ qua các đèn thuộc group OPEN/CLOSE
        if (openCloseGroups.has(group)) {
          return;
        }

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
      const scene: Scene = {
        name: `${sceneName} (${cabinetName})`,
        amount: lights.length,
        lights: [...lights],
        isSequential: false,
      };

      // Kiểm tra xem các group có liên tục không và tất cả đèn có cùng độ sáng không
      const isGroupContinuous = checkContinuousGroups(lights);

      if (isGroupContinuous && lights.length > 0) {
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
  } else {
    // Tạo scenes thông thường không có chỉ số tủ
    scenes = createScenesFromLightData(
      lightsByGroup,
      openCloseGroups,
      regularSceneNames
    );
  }

  // Nếu có scene MASTER ON/OFF, tạo hai scene MASTER ON và MASTER OFF
  if (masterOnOffIndex !== -1) {
    const masterScenes = createMasterScenes(allLights, cabinetName);
    scenes.push(...masterScenes);
  }

  // Tạo các scene OPEN/CLOSE
  const openCloseScenes = createOpenCloseScenes(
    openCloseLightsByNumber,
    cabinetName
  );
  scenes.push(...openCloseScenes);

  return { scenes };
}

/**
 * Xử lý dữ liệu CSV đã parse
 */
function processCSVData(rows: CSVRow[]): {
  scenes: Scene[];
  schedules: Schedule[];
} {
  if (rows.length < 5) {
    throw new Error("CSV file is too short or empty");
  }

  // Sử dụng hàm chung để xử lý dữ liệu
  const { scenes: originalScenes } = processCSVDataCommon(rows);

  // Phân loại scene thành scene thông thường và scene OPEN/CLOSE
  // Theo yêu cầu, tất cả scene OPEN/CLOSE sẽ được đặt ở cuối danh sách
  const regularScenes: Scene[] = [];
  const openCloseScenes: Scene[] = [];

  originalScenes.forEach((scene) => {
    const sceneName = scene.name.toUpperCase();
    if (sceneName.startsWith("OPEN") || sceneName.startsWith("CLOSE")) {
      openCloseScenes.push(scene);
    } else {
      regularScenes.push(scene);
    }
  });

  // Kết hợp các scene, đặt scene thông thường trước và scene OPEN/CLOSE sau
  // Điều này đảm bảo tất cả scene OPEN/CLOSE luôn ở cuối danh sách
  const scenes: Scene[] = [...regularScenes, ...openCloseScenes];

  // Tạo schedules với thời gian cố định
  const schedules: Schedule[] = createSchedulesFromScenes(scenes);

  return { scenes, schedules };
}

// Cached cabinet header keywords
const CABINET_HEADER_KEYWORDS = ["TỦ ĐIỆN", "TU DIEN"];

/**
 * Tìm tất cả các header của tủ điện trong CSV
 * @param rows Dữ liệu CSV đã parse
 * @returns Danh sách header của tủ điện
 */
function findCabinetHeaders(
  rows: CSVRow[]
): { name: string; startRow: number }[] {
  const cabinetHeaders: { name: string; startRow: number }[] = [];
  const DEFAULT_CABINET_NAME = "Tủ không tên";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowValues = Object.values(row);
    const rowStr = rowValues.join(",").toUpperCase();

    // Kiểm tra xem dòng có chứa từ khóa header tủ không
    if (CABINET_HEADER_KEYWORDS.some((keyword) => rowStr.includes(keyword))) {
      let cabinetName = DEFAULT_CABINET_NAME;

      // Tìm cột chứa từ khóa "TỦ ĐIỆN" hoặc "TU DIEN"
      let tuDienColumnIndex = -1;
      for (const [key, value] of Object.entries(row)) {
        if (
          value &&
          typeof value === "string" &&
          CABINET_HEADER_KEYWORDS.some((keyword) =>
            value.toUpperCase().includes(keyword)
          )
        ) {
          tuDienColumnIndex = parseInt(key);
          break;
        }
      }

      // Nếu tìm thấy cột chứa từ khóa "TỦ ĐIỆN", lấy giá trị ở cột tiếp theo
      if (tuDienColumnIndex !== -1) {
        const nextColumnIndex = tuDienColumnIndex + 1;
        const nextColumnValue = row[nextColumnIndex];

        if (
          nextColumnValue &&
          typeof nextColumnValue === "string" &&
          nextColumnValue.trim() !== ""
        ) {
          cabinetName = nextColumnValue.trim();
        }
      }

      cabinetHeaders.push({
        name: cabinetName,
        startRow: i,
      });
    }
  }

  return cabinetHeaders;
}

/**
 * Xử lý dữ liệu CSV đã parse với chế độ tủ riêng biệt
 * @param rows Dữ liệu CSV đã parse
 * @returns Object chứa scenes và schedules
 */
function processCSVDataWithSeparateCabinets(rows: CSVRow[]): {
  scenes: Scene[];
  schedules: Schedule[];
} {
  if (rows.length < 5) {
    throw new Error("CSV file is too short or empty");
  }

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

  // Mảng để lưu các scene thông thường và scene OPEN/CLOSE riêng biệt
  // Theo yêu cầu, tất cả scene OPEN/CLOSE sẽ được đặt ở cuối danh sách, không phân biệt tủ
  const regularScenes: Scene[] = [];
  const openCloseScenes: Scene[] = [];

  // Xử lý từng tủ
  cabinets.forEach((cabinet) => {
    const cabinetRows = rows.slice(cabinet.startRow, cabinet.endRow + 1);

    // Xử lý dữ liệu của tủ hiện tại
    const { scenes } = processCSVDataForCabinet(cabinetRows, cabinet.name);

    // Phân loại scene thành scene thông thường và scene OPEN/CLOSE
    // Tất cả scene OPEN/CLOSE từ mọi tủ sẽ được gom lại và đặt ở cuối danh sách
    scenes.forEach((scene) => {
      const sceneName = scene.name.toUpperCase();
      if (sceneName.startsWith("OPEN") || sceneName.startsWith("CLOSE")) {
        openCloseScenes.push(scene);
      } else {
        regularScenes.push(scene);
      }
    });
  });

  // Kết hợp các scene, đặt scene thông thường trước và scene OPEN/CLOSE sau
  // Điều này đảm bảo tất cả scene OPEN/CLOSE luôn ở cuối danh sách, không phân biệt tủ
  const allScenes: Scene[] = [...regularScenes, ...openCloseScenes];

  // Tạo schedules với thời gian cố định
  const schedules: Schedule[] = createSchedulesFromScenes(allScenes);

  return { scenes: allScenes, schedules };
}

/**
 * Xử lý dữ liệu CSV cho một tủ cụ thể
 * @param rows Dữ liệu CSV của tủ
 * @param cabinetName Tên tủ
 * @returns Object chứa scenes của tủ
 */
function processCSVDataForCabinet(
  rows: CSVRow[],
  cabinetName: string
): SceneProcessingResult {
  // Sử dụng hàm chung để xử lý dữ liệu
  return processCSVDataCommon(rows, cabinetName);
}

/**
 * Tạo schedules từ danh sách scenes (chỉ cho DAY TIME, NIGHT TIME, và LATE TIME)
 * Mỗi schedule sẽ bao gồm tất cả các scene cùng loại từ tất cả các tủ
 * Ví dụ: Schedule DAY TIME sẽ bao gồm "DAY TIME (DMX-LT-GYM)", "DAY TIME (DMX-LT-BR1)", v.v.
 * @param scenes Danh sách scenes
 * @returns Danh sách schedules
 */
function createSchedulesFromScenes(scenes: Scene[]): Schedule[] {
  const schedules: Schedule[] = [];

  // Tạo map để nhóm các scene theo tên cơ bản (không bao gồm tên tủ)
  // Ví dụ: "DAY TIME (DMX-LT-GYM)" và "DAY TIME (DMX-LT-BR1)" sẽ được nhóm vào cùng một key "DAY TIME"
  const sceneGroups: { [key: string]: number[] } = {};

  // Tạo map để lưu trữ index của scene theo tên
  const sceneIndexMap: { [key: string]: number } = {};
  scenes.forEach((scene, index) => {
    sceneIndexMap[scene.name] = index;

    // Lấy tên cơ bản của scene bằng cách loại bỏ phần tên tủ trong ngoặc đơn
    // Ví dụ: "DAY TIME (DMX-LT-GYM)" -> "DAY TIME"
    const baseSceneName = scene.name.replace(/\s+\([^)]+\)$/, "");

    // Khởi tạo mảng nếu chưa tồn tại
    if (!sceneGroups[baseSceneName]) {
      sceneGroups[baseSceneName] = [];
    }

    // Thêm index của scene vào nhóm tương ứng (1-based index)
    sceneGroups[baseSceneName].push(index + 1);
  });

  // Cấu hình thời gian cố định cho các loại scene
  // Mỗi loại scene sẽ có một thời gian cố định
  const fixedTimeMap: { [key: string]: { hour: number; minute: number } } = {
    DAY: { hour: 6, minute: 0 }, // DAY TIME: 6:00
    NIGHT: { hour: 18, minute: 0 }, // NIGHT TIME: 18:00
    LATE: { hour: 1, minute: 0 }, // LATE TIME: 1:00
  };

  // Tạo schedules cho DAY TIME, NIGHT TIME, và LATE TIME
  // Mỗi schedule sẽ bao gồm tất cả các scene cùng loại từ tất cả các tủ
  Object.entries(sceneGroups).forEach(([baseSceneName, sceneIndices]) => {
    const upperSceneName = baseSceneName.toUpperCase();

    // Xác định loại scene và thời gian tương ứng
    let scheduleTime = null;

    // Kiểm tra xem tên scene có chứa từ khóa DAY, NIGHT hoặc LATE không
    if (upperSceneName.includes("DAY")) {
      scheduleTime = fixedTimeMap["DAY"];
    } else if (upperSceneName.includes("NIGHT")) {
      scheduleTime = fixedTimeMap["NIGHT"];
    } else if (upperSceneName.includes("LATE")) {
      scheduleTime = fixedTimeMap["LATE"];
    }

    // Chỉ tạo schedule cho các scene DAY TIME, NIGHT TIME, và LATE TIME
    if (scheduleTime) {
      // Tạo một schedule mới với tất cả các scene cùng loại từ tất cả các tủ
      schedules.push({
        name: baseSceneName,
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
        hour: scheduleTime.hour,
        minute: scheduleTime.minute,
      });
    }
  });

  return schedules;
}
