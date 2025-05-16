import { Light, Scene, Schedule } from "@/types/app-types";
import csvParser from "csv-parser";
import { Readable } from "stream";

/**
 * Kiểm tra xem các group có liên tục không và tất cả đèn có cùng độ sáng không
 * @param lights Danh sách đèn cần kiểm tra
 * @returns true nếu các group liên tục và tất cả đèn có cùng độ sáng, false nếu không
 */
function checkContinuousGroups(lights: Light[]): boolean {
  if (lights.length <= 1) return true;

  // Sắp xếp đèn theo group
  const sortedLights = [...lights].sort((a, b) => a.group - b.group);

  // Kiểm tra xem tất cả đèn có cùng độ sáng không
  const firstValue = sortedLights[0].value;
  const allSameBrightness = sortedLights.every(
    (light) => light.value === firstValue
  );

  if (!allSameBrightness) {
    return false;
  }

  // Kiểm tra xem các group có liên tục không
  for (let i = 1; i < sortedLights.length; i++) {
    if (sortedLights[i].group !== sortedLights[i - 1].group + 1) {
      return false;
    }
  }

  return true;
}

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
    try {
      // Tạo một stream từ nội dung CSV
      const stream = Readable.from([csvContent]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = [];

      // Sử dụng csv-parser để parse dữ liệu
      stream
        .pipe(
          csvParser({
            skipLines: 0,
            headers: false,
            skipComments: true,
          })
        )
        .on("data", (data) => results.push(data))
        .on("end", () => {
          try {
            // Xử lý dữ liệu đã parse
            if (separateCabinets) {
              // Xử lý từng tủ riêng biệt
              const processedData = processCSVDataWithSeparateCabinets(results);
              resolve(processedData);
            } else {
              // Xử lý tất cả tủ cùng nhau (cách cũ)
              const processedData = processCSVData(results);
              resolve(processedData);
            }
          } catch (error) {
            reject(error);
          }
        })
        .on("error", (error) => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Xử lý dữ liệu CSV đã parse
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processCSVData(rows: any[]): {
  scenes: Scene[];
  schedules: Schedule[];
} {
  if (rows.length < 5) {
    throw new Error("CSV file is too short or empty");
  }

  // Tìm hàng chứa thông tin về scene
  let sceneHeaderRow = -1;
  let sceneNameRow = -1;

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowValues = Object.values(rows[i]);
    const rowStr = rowValues.join(",");

    if (rowStr.includes("SCENE SETTING") || rowStr.includes("SCENE OVERIDE")) {
      sceneHeaderRow = i;
      sceneNameRow = i + 1;
      break;
    }
  }

  if (sceneHeaderRow === -1 || sceneNameRow === -1) {
    throw new Error("Could not find scene header row in CSV");
  }

  // Tìm các cột chứa tên scene
  const sceneColumns: { [key: string]: number } = {};
  const sceneNames: string[] = [];
  const sceneTimeInfo: { [key: string]: { hour: number; minute: number } } = {};

  Object.entries(rows[sceneNameRow]).forEach(([key, value]) => {
    if (
      value &&
      typeof value === "string" &&
      value.trim() !== "" &&
      !value.includes(":")
    ) {
      const sceneName = value.trim();
      const colIndex = parseInt(key);
      sceneColumns[sceneName] = colIndex;
      sceneNames.push(sceneName);

      // Kiểm tra dòng tiếp theo để lấy thông tin thời gian
      if (sceneNameRow + 1 < rows.length) {
        const timeValue = rows[sceneNameRow + 1][colIndex];
        if (timeValue && typeof timeValue === "string") {
          // Tìm kiếm định dạng thời gian (ví dụ: "6:00", "18:00")
          const timeMatch = timeValue.match(/(\d+):(\d+)/);
          if (timeMatch) {
            const hour = parseInt(timeMatch[1]);
            const minute = parseInt(timeMatch[2]);
            if (!isNaN(hour) && !isNaN(minute)) {
              sceneTimeInfo[sceneName] = { hour, minute };
            }
          }
        }
      }
    }
  });

  if (sceneNames.length === 0) {
    throw new Error("No scene names found in CSV");
  }

  // Tìm cột chứa thông tin về group và tên đèn
  let groupColumn = -1;
  let nameColumn = -1;

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    Object.entries(rows[i]).forEach(([key, value]) => {
      if (value && typeof value === "string") {
        const valueStr = value.toString().toUpperCase();

        if (valueStr.includes("GROUP") || valueStr.includes("ĐỊA CHỈ")) {
          groupColumn = parseInt(key);
        }

        if (valueStr.includes("TÊN LỘ") || valueStr.includes("TEN LO")) {
          nameColumn = parseInt(key);
        }
      }
    });

    if (groupColumn !== -1) {
      break;
    }
  }

  if (groupColumn === -1) {
    throw new Error("Could not find Group column in CSV");
  }

  // Tạo scenes
  const scenes: Scene[] = sceneNames.map((name) => ({
    name,
    amount: 0,
    lights: [],
    isSequential: false,
  }));

  // Xử lý từng dòng để lấy thông tin đèn
  const lightsByGroup: {
    [key: number]: { name: string; values: { [key: string]: number } };
  } = {};

  // Lưu trữ đèn OPEN và CLOSE theo số
  const openCloseLightsByNumber: {
    [key: string]: { open: Light[]; close: Light[] };
  } = {};

  // Lưu trữ danh sách các group đèn OPEN/CLOSE để loại bỏ khỏi scene thông thường
  const openCloseGroups = new Set<number>();

  // Lưu trữ danh sách các group đã xuất hiện để kiểm tra trùng lặp
  const groupCounts: { [key: number]: number } = {};

  // Đầu tiên, đếm số lần xuất hiện của mỗi group
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Bỏ qua các dòng không có thông tin group
    if (
      !row[groupColumn] ||
      !row[groupColumn].toString().toUpperCase().includes("GROUP")
    ) {
      continue;
    }

    // Lấy số group
    const groupMatch = row[groupColumn].toString().match(/GROUP\s*(\d+)/i);
    if (!groupMatch) {
      continue;
    }

    const groupNumber = parseInt(groupMatch[1]);

    // Lấy tên đèn
    let lightName = "Đèn chưa đặt tên";
    if (
      nameColumn !== -1 &&
      row[nameColumn] &&
      row[nameColumn].toString().trim() !== ""
    ) {
      lightName = row[nameColumn].toString().trim();
    }

    // Kiểm tra xem đèn có phải là OPEN hoặc CLOSE không
    const isOpenLight = lightName.toUpperCase().startsWith("OPEN");
    const isCloseLight = lightName.toUpperCase().startsWith("CLOSE");

    // Không đếm đèn OPEN/CLOSE
    if (isOpenLight || isCloseLight) {
      continue;
    }

    // Tăng số lần xuất hiện của group
    groupCounts[groupNumber] = (groupCounts[groupNumber] || 0) + 1;
  }

  // Sau đó, xử lý từng dòng để lấy thông tin đèn
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Bỏ qua các dòng không có thông tin group
    if (
      !row[groupColumn] ||
      !row[groupColumn].toString().toUpperCase().includes("GROUP")
    ) {
      continue;
    }

    // Lấy số group
    const groupMatch = row[groupColumn].toString().match(/GROUP\s+(\d+)/i);
    if (!groupMatch) {
      continue;
    }

    const groupNumber = parseInt(groupMatch[1]);
    const groupName = `Group ${groupNumber}`;

    // Lấy tên đèn
    let lightName = "Đèn chưa đặt tên";
    if (
      nameColumn !== -1 &&
      row[nameColumn] &&
      row[nameColumn].toString().trim() !== ""
    ) {
      lightName = row[nameColumn].toString().trim();
    }

    // Kiểm tra xem đèn có phải là OPEN hoặc CLOSE không
    const isOpenLight = lightName.toUpperCase().startsWith("OPEN");
    const isCloseLight = lightName.toUpperCase().startsWith("CLOSE");

    // Xác định số của OPEN/CLOSE (ví dụ: OPEN 1 -> 1)
    let openCloseNumber = "";
    if (isOpenLight || isCloseLight) {
      const match = lightName.match(/\d+/);
      if (match) {
        openCloseNumber = match[0];
      }
    }

    // Lấy giá trị độ sáng cho từng scene
    const sceneValues: { [key: string]: number } = {};

    sceneNames.forEach((sceneName) => {
      const colIndex = sceneColumns[sceneName];

      // Kiểm tra xem cột có tồn tại không
      if (colIndex !== undefined) {
        // Lấy giá trị từ cột, xử lý cả trường hợp giá trị là 0
        const cellValue = row[colIndex];
        let value = "";

        // Kiểm tra xem giá trị có tồn tại không (bao gồm cả 0)
        if (cellValue !== undefined && cellValue !== null) {
          value = cellValue.toString().trim();
        }

        // Chuyển đổi giá trị
        if (value.toLowerCase() === "on" || value.toLowerCase() === "on/off") {
          value = "100";
        } else if (value.toLowerCase() === "off") {
          value = "0";
        } else {
          // Loại bỏ dấu phần trăm
          value = value.replace(/%/g, "");
        }

        // Mặc định là 100 nếu trống
        if (value === "") {
          value = "100";
        }

        // Chuyển đổi thành số
        const brightness = parseInt(value);

        // Kiểm tra giá trị hợp lệ
        if (!isNaN(brightness) && brightness >= 0 && brightness <= 100) {
          sceneValues[sceneName] = brightness;
        } else {
          sceneValues[sceneName] = 100; // Giá trị mặc định
        }
      } else {
        sceneValues[sceneName] = 100; // Giá trị mặc định
      }
    });

    // Xử lý đèn OPEN/CLOSE
    if ((isOpenLight || isCloseLight) && openCloseNumber) {
      // Tạo key dựa trên số của đèn OPEN/CLOSE
      const numberKey = openCloseNumber;

      // Khởi tạo cấu trúc lưu trữ nếu chưa tồn tại
      if (!openCloseLightsByNumber[numberKey]) {
        openCloseLightsByNumber[numberKey] = {
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
        openCloseLightsByNumber[numberKey].open.push(light);
      } else {
        openCloseLightsByNumber[numberKey].close.push(light);
      }

      // Thêm group vào danh sách các group đèn OPEN/CLOSE
      openCloseGroups.add(groupNumber);
    } else {
      // Kiểm tra xem group có trùng lặp không
      const isDuplicateGroup = groupCounts[groupNumber] > 1;

      // Lưu thông tin đèn thông thường theo group (không phải OPEN/CLOSE)
      lightsByGroup[groupNumber] = {
        // Nếu group trùng lặp, sử dụng tên group, ngược lại sử dụng tên đèn gốc
        name: isDuplicateGroup ? groupName : lightName,
        values: sceneValues,
      };
    }
  }

  // Tạo danh sách đèn cho từng scene
  sceneNames.forEach((sceneName, sceneIndex) => {
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

    // Cập nhật scene
    scenes[sceneIndex].lights = lights;
    scenes[sceneIndex].amount = lights.length;
  });

  // Tạo danh sách tên các scene OPEN/CLOSE để kiểm tra trùng lặp
  const openCloseSceneNames = new Set<string>();
  Object.keys(openCloseLightsByNumber).forEach((number) => {
    openCloseSceneNames.add(`OPEN ${number}`);
    openCloseSceneNames.add(`CLOSE ${number}`);
  });

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

  // Xóa tất cả các scene hiện tại
  scenes.length = 0;

  // Thêm lại các scene thông thường không trùng tên với scene OPEN/CLOSE và không phải MASTER ON/OFF
  sceneNames.forEach((name, index) => {
    // Bỏ qua scene OPEN/CLOSE và MASTER ON/OFF
    if (openCloseSceneNames.has(name) || index === masterOnOffIndex) {
      return;
    }

    scenes.push({
      name,
      amount: 0,
      lights: [],
      isSequential: false,
    });
  });

  // Cập nhật lại danh sách đèn cho các scene thông thường
  scenes.forEach((scene) => {
    const lights: Light[] = [];

    // Thêm đèn từ mỗi group vào scene (trừ đèn OPEN/CLOSE)
    Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
      const group = parseInt(groupStr);

      // Bỏ qua các đèn thuộc group OPEN/CLOSE
      if (openCloseGroups.has(group)) {
        return;
      }

      const value =
        lightInfo.values[scene.name] !== undefined
          ? lightInfo.values[scene.name]
          : 100;

      lights.push({
        name: lightInfo.name,
        group,
        value,
      });
    });

    // Sắp xếp đèn theo group
    lights.sort((a, b) => a.group - b.group);

    // Cập nhật scene
    scene.lights = lights;
    scene.amount = lights.length;

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
  });

  // Nếu có scene MASTER ON/OFF, tạo hai scene MASTER ON và MASTER OFF
  if (masterOnOffIndex !== -1) {
    // Tạo scene MASTER ON
    if (allLights.length > 0) {
      const masterOnLights = allLights.map((light) => ({
        ...light,
        value: 100, // Tất cả đèn có độ sáng 100%
      }));

      // Kiểm tra xem các group có liên tục không
      const isGroupContinuous = checkContinuousGroups(masterOnLights);

      if (isGroupContinuous) {
        // Nếu các group liên tục, sử dụng mode group liên tục
        const minGroup = Math.min(
          ...masterOnLights.map((light) => light.group)
        );
        scenes.push({
          name: "MASTER ON",
          amount: masterOnLights.length,
          lights: [{ name: "Đèn chưa đặt tên", group: minGroup, value: 100 }],
          isSequential: true,
          startGroup: minGroup,
        });
      } else {
        // Nếu các group không liên tục, sử dụng mode thông thường
        scenes.push({
          name: "MASTER ON",
          amount: masterOnLights.length,
          lights: masterOnLights,
          isSequential: false,
        });
      }
    }

    // Tạo scene MASTER OFF
    if (allLights.length > 0) {
      const masterOffLights = allLights.map((light) => ({
        ...light,
        value: 0, // Tất cả đèn có độ sáng 0%
      }));

      // Kiểm tra xem các group có liên tục không
      const isGroupContinuous = checkContinuousGroups(masterOffLights);

      if (isGroupContinuous) {
        // Nếu các group liên tục, sử dụng mode group liên tục
        const minGroup = Math.min(
          ...masterOffLights.map((light) => light.group)
        );
        scenes.push({
          name: "MASTER OFF",
          amount: masterOffLights.length,
          lights: [{ name: "Đèn chưa đặt tên", group: minGroup, value: 0 }],
          isSequential: true,
          startGroup: minGroup,
        });
      } else {
        // Nếu các group không liên tục, sử dụng mode thông thường
        scenes.push({
          name: "MASTER OFF",
          amount: masterOffLights.length,
          lights: masterOffLights,
          isSequential: false,
        });
      }
    }
  }

  // Tạo các scene OPEN/CLOSE
  Object.entries(openCloseLightsByNumber).forEach(([number, lightsObj]) => {
    // Tạo danh sách đèn cho scene OPEN
    const openSceneLights: Light[] = [];

    // Thêm đèn OPEN với độ sáng 100%
    lightsObj.open.forEach((light) => {
      openSceneLights.push({
        ...light,
        value: 100, // Đèn OPEN sáng 100% trong scene OPEN
      });
    });

    // Thêm đèn CLOSE với độ sáng 0%
    lightsObj.close.forEach((light) => {
      openSceneLights.push({
        ...light,
        value: 0, // Đèn CLOSE tắt (0%) trong scene OPEN
      });
    });

    // Sắp xếp đèn theo group
    openSceneLights.sort((a, b) => a.group - b.group);

    // Thêm scene OPEN mới
    if (openSceneLights.length > 0) {
      scenes.push({
        name: `OPEN ${number}`,
        amount: openSceneLights.length,
        lights: openSceneLights,
        isSequential: false,
      });
    }

    // Tạo danh sách đèn cho scene CLOSE
    const closeSceneLights: Light[] = [];

    // Thêm đèn OPEN với độ sáng 0%
    lightsObj.open.forEach((light) => {
      closeSceneLights.push({
        ...light,
        value: 0, // Đèn OPEN tắt (0%) trong scene CLOSE
      });
    });

    // Thêm đèn CLOSE với độ sáng 100%
    lightsObj.close.forEach((light) => {
      closeSceneLights.push({
        ...light,
        value: 100, // Đèn CLOSE sáng 100% trong scene CLOSE
      });
    });

    // Sắp xếp đèn theo group
    closeSceneLights.sort((a, b) => a.group - b.group);

    // Thêm scene CLOSE mới
    if (closeSceneLights.length > 0) {
      scenes.push({
        name: `CLOSE ${number}`,
        amount: closeSceneLights.length,
        lights: closeSceneLights,
        isSequential: false,
      });
    }
  });

  // Tạo schedules bằng cách sử dụng thông tin thời gian từ CSV
  const schedules: Schedule[] = createSchedulesFromScenes(
    scenes,
    sceneTimeInfo
  );

  return { scenes, schedules };
}

/**
 * Xử lý dữ liệu CSV đã parse với chế độ tủ riêng biệt
 * @param rows Dữ liệu CSV đã parse
 * @returns Object chứa scenes và schedules
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processCSVDataWithSeparateCabinets(rows: any[]): {
  scenes: Scene[];
  schedules: Schedule[];
} {
  if (rows.length < 5) {
    throw new Error("CSV file is too short or empty");
  }

  // Tìm tất cả các header của tủ điện
  const cabinetHeaders: { name: string; startRow: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowValues = Object.values(rows[i]);
    const rowStr = rowValues.join(",");

    if (rowStr.includes("TỦ ĐIỆN") || rowStr.includes("TU DIEN")) {
      let cabinetName = "Tủ không tên";

      // Lấy tên tủ từ dòng header
      for (const value of rowValues) {
        if (value && typeof value === "string" && value.includes("DMX-")) {
          cabinetName = value.trim();
          break;
        }
      }

      cabinetHeaders.push({
        name: cabinetName,
        startRow: i,
      });
    }
  }

  if (cabinetHeaders.length === 0) {
    throw new Error("Không tìm thấy thông tin tủ điện trong file CSV");
  }

  // Xác định phạm vi dữ liệu cho mỗi tủ
  const cabinets: {
    name: string;
    startRow: number;
    endRow: number;
    scenes: Scene[];
  }[] = [];

  for (let i = 0; i < cabinetHeaders.length; i++) {
    const endRow =
      i < cabinetHeaders.length - 1
        ? cabinetHeaders[i + 1].startRow - 1
        : rows.length - 1;

    cabinets.push({
      name: cabinetHeaders[i].name,
      startRow: cabinetHeaders[i].startRow,
      endRow: endRow,
      scenes: [],
    });
  }

  // Xử lý dữ liệu cho từng tủ
  const allSceneTimeInfo: { [key: string]: { hour: number; minute: number } } =
    {};

  for (let i = 0; i < cabinets.length; i++) {
    const cabinet = cabinets[i];
    const cabinetRows = rows.slice(cabinet.startRow, cabinet.endRow + 1);

    // Xử lý dữ liệu của tủ hiện tại
    const cabinetData = processCSVDataForCabinet(
      cabinetRows,
      cabinet.name,
      i + 1
    );
    cabinet.scenes = cabinetData.scenes;

    // Lưu thông tin thời gian của scene
    // Chuyển đổi tên scene gốc thành tên scene có chỉ số tủ
    Object.entries(cabinetData.sceneTimeInfo).forEach(
      ([sceneName, timeInfo]) => {
        const sceneNameWithIndex = `${sceneName} ${i + 1}`;
        allSceneTimeInfo[sceneNameWithIndex] = timeInfo;
      }
    );
  }

  // Gộp tất cả các scene từ các tủ
  const allScenes: Scene[] = [];
  cabinets.forEach((cabinet) => {
    allScenes.push(...cabinet.scenes);
  });

  // Tạo schedules chỉ cho những scene có thông tin thời gian
  const schedules: Schedule[] = createSchedulesFromScenes(
    allScenes,
    allSceneTimeInfo
  );

  return { scenes: allScenes, schedules };
}

/**
 * Xử lý dữ liệu CSV cho một tủ cụ thể
 * @param rows Dữ liệu CSV của tủ
 * @param cabinetName Tên tủ
 * @param cabinetIndex Chỉ số của tủ (1-based)
 * @returns Object chứa scenes của tủ
 */
function processCSVDataForCabinet(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
  cabinetName: string,
  cabinetIndex: number
): {
  scenes: Scene[];
  sceneTimeInfo: { [key: string]: { hour: number; minute: number } };
} {
  // Tìm hàng chứa thông tin về scene
  let sceneHeaderRow = -1;
  let sceneNameRow = -1;

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowValues = Object.values(rows[i]);
    const rowStr = rowValues.join(",");

    if (rowStr.includes("SCENE SETTING") || rowStr.includes("SCENE OVERIDE")) {
      sceneHeaderRow = i;
      sceneNameRow = i + 1;
      break;
    }
  }

  if (sceneHeaderRow === -1 || sceneNameRow === -1) {
    throw new Error(`Không tìm thấy thông tin scene trong tủ ${cabinetName}`);
  }

  // Tìm các cột chứa tên scene
  const sceneColumns: { [key: string]: number } = {};
  const sceneNames: string[] = [];
  const sceneTimeInfo: { [key: string]: { hour: number; minute: number } } = {};

  Object.entries(rows[sceneNameRow]).forEach(([key, value]) => {
    if (
      value &&
      typeof value === "string" &&
      value.trim() !== "" &&
      !value.includes(":")
    ) {
      const sceneName = value.trim();
      const colIndex = parseInt(key);
      sceneColumns[sceneName] = colIndex;
      sceneNames.push(sceneName);

      // Kiểm tra dòng tiếp theo để lấy thông tin thời gian
      if (sceneNameRow + 1 < rows.length) {
        const timeValue = rows[sceneNameRow + 1][colIndex];
        if (timeValue && typeof timeValue === "string") {
          // Tìm kiếm định dạng thời gian (ví dụ: "6:00", "18:00")
          const timeMatch = timeValue.match(/(\d+):(\d+)/);
          if (timeMatch) {
            const hour = parseInt(timeMatch[1]);
            const minute = parseInt(timeMatch[2]);
            if (!isNaN(hour) && !isNaN(minute)) {
              sceneTimeInfo[sceneName] = { hour, minute };
            }
          }
        }
      }
    }
  });

  if (sceneNames.length === 0) {
    throw new Error(`Không tìm thấy tên scene trong tủ ${cabinetName}`);
  }

  // Tìm cột chứa thông tin về group và tên đèn
  let groupColumn = -1;
  let nameColumn = -1;

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    Object.entries(rows[i]).forEach(([key, value]) => {
      if (value && typeof value === "string") {
        const valueStr = value.toString().toUpperCase();

        if (valueStr.includes("GROUP") || valueStr.includes("ĐỊA CHỈ")) {
          groupColumn = parseInt(key);
        }

        if (valueStr.includes("TÊN LỘ") || valueStr.includes("TEN LO")) {
          nameColumn = parseInt(key);
        }
      }
    });

    if (groupColumn !== -1) {
      break;
    }
  }

  if (groupColumn === -1) {
    throw new Error(`Không tìm thấy cột Group trong tủ ${cabinetName}`);
  }

  // Tạo scenes với tên bao gồm chỉ số tủ
  const scenes: Scene[] = sceneNames.map((name) => ({
    name: `${name} ${cabinetIndex}`,
    amount: 0,
    lights: [],
    isSequential: false,
  }));

  // Xử lý từng dòng để lấy thông tin đèn
  const lightsByGroup: {
    [key: number]: { name: string; values: { [key: string]: number } };
  } = {};

  // Lưu trữ đèn OPEN và CLOSE theo số
  const openCloseLightsByNumber: {
    [key: string]: { open: Light[]; close: Light[] };
  } = {};

  // Lưu trữ danh sách các group đèn OPEN/CLOSE để loại bỏ khỏi scene thông thường
  const openCloseGroups = new Set<number>();

  // Lưu trữ danh sách các group đã xuất hiện để kiểm tra trùng lặp
  const groupCounts: { [key: number]: number } = {};

  // Đầu tiên, đếm số lần xuất hiện của mỗi group
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Bỏ qua các dòng không có thông tin group
    if (
      !row[groupColumn] ||
      !row[groupColumn].toString().toUpperCase().includes("GROUP")
    ) {
      continue;
    }

    // Lấy số group
    const groupMatch = row[groupColumn].toString().match(/GROUP\s*(\d+)/i);
    if (!groupMatch) {
      continue;
    }

    const groupNumber = parseInt(groupMatch[1]);

    // Lấy tên đèn
    let lightName = "Đèn chưa đặt tên";
    if (
      nameColumn !== -1 &&
      row[nameColumn] &&
      row[nameColumn].toString().trim() !== ""
    ) {
      lightName = row[nameColumn].toString().trim();
    }

    // Kiểm tra xem đèn có phải là OPEN hoặc CLOSE không
    const isOpenLight = lightName.toUpperCase().startsWith("OPEN");
    const isCloseLight = lightName.toUpperCase().startsWith("CLOSE");

    // Không đếm đèn OPEN/CLOSE
    if (isOpenLight || isCloseLight) {
      continue;
    }

    // Tăng số lần xuất hiện của group
    groupCounts[groupNumber] = (groupCounts[groupNumber] || 0) + 1;
  }

  // Sau đó, xử lý từng dòng để lấy thông tin đèn
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Bỏ qua các dòng không có thông tin group
    if (
      !row[groupColumn] ||
      !row[groupColumn].toString().toUpperCase().includes("GROUP")
    ) {
      continue;
    }

    // Lấy số group
    const groupMatch = row[groupColumn].toString().match(/GROUP\s+(\d+)/i);
    if (!groupMatch) {
      continue;
    }

    const groupNumber = parseInt(groupMatch[1]);
    const groupName = `Group ${groupNumber}`;

    // Lấy tên đèn
    let lightName = "Đèn chưa đặt tên";
    if (
      nameColumn !== -1 &&
      row[nameColumn] &&
      row[nameColumn].toString().trim() !== ""
    ) {
      lightName = row[nameColumn].toString().trim();
    }

    // Kiểm tra xem đèn có phải là OPEN hoặc CLOSE không
    const isOpenLight = lightName.toUpperCase().startsWith("OPEN");
    const isCloseLight = lightName.toUpperCase().startsWith("CLOSE");

    // Xác định số của OPEN/CLOSE (ví dụ: OPEN 1 -> 1)
    let openCloseNumber = "";
    if (isOpenLight || isCloseLight) {
      const match = lightName.match(/\d+/);
      if (match) {
        openCloseNumber = match[0];
      }
    }

    // Lấy giá trị độ sáng cho từng scene
    const sceneValues: { [key: string]: number } = {};

    sceneNames.forEach((sceneName) => {
      const colIndex = sceneColumns[sceneName];

      // Kiểm tra xem cột có tồn tại không
      if (colIndex !== undefined) {
        // Lấy giá trị từ cột, xử lý cả trường hợp giá trị là 0
        const cellValue = row[colIndex];
        let value = "";

        // Kiểm tra xem giá trị có tồn tại không (bao gồm cả 0)
        if (cellValue !== undefined && cellValue !== null) {
          value = cellValue.toString().trim();
        }

        // Chuyển đổi giá trị
        if (value.toLowerCase() === "on" || value.toLowerCase() === "on/off") {
          value = "100";
        } else if (value.toLowerCase() === "off") {
          value = "0";
        } else {
          // Loại bỏ dấu phần trăm
          value = value.replace(/%/g, "");
        }

        // Mặc định là 100 nếu trống
        if (value === "") {
          value = "100";
        }

        // Chuyển đổi thành số
        const brightness = parseInt(value);

        // Kiểm tra giá trị hợp lệ
        if (!isNaN(brightness) && brightness >= 0 && brightness <= 100) {
          sceneValues[sceneName] = brightness;
        } else {
          sceneValues[sceneName] = 100; // Giá trị mặc định
        }
      } else {
        sceneValues[sceneName] = 100; // Giá trị mặc định
      }
    });

    // Xử lý đèn OPEN/CLOSE
    if ((isOpenLight || isCloseLight) && openCloseNumber) {
      // Tạo key dựa trên số của đèn OPEN/CLOSE
      const numberKey = openCloseNumber;

      // Khởi tạo cấu trúc lưu trữ nếu chưa tồn tại
      if (!openCloseLightsByNumber[numberKey]) {
        openCloseLightsByNumber[numberKey] = {
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
        openCloseLightsByNumber[numberKey].open.push(light);
      } else {
        openCloseLightsByNumber[numberKey].close.push(light);
      }

      // Thêm group vào danh sách các group đèn OPEN/CLOSE
      openCloseGroups.add(groupNumber);
    } else {
      // Kiểm tra xem group có trùng lặp không
      const isDuplicateGroup = groupCounts[groupNumber] > 1;

      // Lưu thông tin đèn thông thường theo group (không phải OPEN/CLOSE)
      lightsByGroup[groupNumber] = {
        // Nếu group trùng lặp, sử dụng tên group, ngược lại sử dụng tên đèn gốc
        name: isDuplicateGroup ? groupName : lightName,
        values: sceneValues,
      };
    }
  }

  // Tạo danh sách đèn cho từng scene
  scenes.forEach((scene, sceneIndex) => {
    const originalSceneName = sceneNames[sceneIndex];
    const lights: Light[] = [];

    // Thêm đèn từ mỗi group vào scene (trừ đèn OPEN/CLOSE)
    Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
      const group = parseInt(groupStr);

      // Bỏ qua các đèn thuộc group OPEN/CLOSE
      if (openCloseGroups.has(group)) {
        return;
      }

      const value =
        lightInfo.values[originalSceneName] !== undefined
          ? lightInfo.values[originalSceneName]
          : 100;

      lights.push({
        name: lightInfo.name,
        group,
        value,
      });
    });

    // Sắp xếp đèn theo group
    lights.sort((a, b) => a.group - b.group);

    // Cập nhật scene
    scene.lights = lights;
    scene.amount = lights.length;

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
  });

  // Tạo danh sách tên các scene OPEN/CLOSE để kiểm tra trùng lặp
  const openCloseSceneNames = new Set<string>();
  Object.keys(openCloseLightsByNumber).forEach((number) => {
    openCloseSceneNames.add(`OPEN ${number}`);
    openCloseSceneNames.add(`CLOSE ${number}`);
  });

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

  // Xóa tất cả các scene hiện tại
  scenes.length = 0;

  // Thêm lại các scene thông thường không trùng tên với scene OPEN/CLOSE và không phải MASTER ON/OFF
  sceneNames.forEach((name, index) => {
    // Bỏ qua scene OPEN/CLOSE và MASTER ON/OFF
    if (openCloseSceneNames.has(name) || index === masterOnOffIndex) {
      return;
    }

    scenes.push({
      name: `${name} ${cabinetIndex}`,
      amount: 0,
      lights: [],
      isSequential: false,
    });
  });

  // Cập nhật lại danh sách đèn cho các scene thông thường
  scenes.forEach((scene) => {
    // Lấy tên scene gốc (không có chỉ số tủ)
    const originalSceneName = scene.name.replace(` ${cabinetIndex}`, "");
    const lights: Light[] = [];

    // Thêm đèn từ mỗi group vào scene (trừ đèn OPEN/CLOSE)
    Object.entries(lightsByGroup).forEach(([groupStr, lightInfo]) => {
      const group = parseInt(groupStr);

      // Bỏ qua các đèn thuộc group OPEN/CLOSE
      if (openCloseGroups.has(group)) {
        return;
      }

      const value =
        lightInfo.values[originalSceneName] !== undefined
          ? lightInfo.values[originalSceneName]
          : 100;

      lights.push({
        name: lightInfo.name,
        group,
        value,
      });
    });

    // Sắp xếp đèn theo group
    lights.sort((a, b) => a.group - b.group);

    // Cập nhật scene
    scene.lights = lights;
    scene.amount = lights.length;

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
  });

  // Nếu có scene MASTER ON/OFF, tạo hai scene MASTER ON và MASTER OFF
  if (masterOnOffIndex !== -1) {
    // Tạo scene MASTER ON
    if (allLights.length > 0) {
      const masterOnLights = allLights.map((light) => ({
        ...light,
        value: 100, // Tất cả đèn có độ sáng 100%
      }));

      // Kiểm tra xem các group có liên tục không
      const isGroupContinuous = checkContinuousGroups(masterOnLights);

      if (isGroupContinuous) {
        // Nếu các group liên tục, sử dụng mode group liên tục
        const minGroup = Math.min(
          ...masterOnLights.map((light) => light.group)
        );
        scenes.push({
          name: `MASTER ON ${cabinetIndex}`,
          amount: masterOnLights.length,
          lights: [{ name: "Đèn chưa đặt tên", group: minGroup, value: 100 }],
          isSequential: true,
          startGroup: minGroup,
        });
      } else {
        // Nếu các group không liên tục, sử dụng mode thông thường
        scenes.push({
          name: `MASTER ON ${cabinetIndex}`,
          amount: masterOnLights.length,
          lights: masterOnLights,
          isSequential: false,
        });
      }
    }

    // Tạo scene MASTER OFF
    if (allLights.length > 0) {
      const masterOffLights = allLights.map((light) => ({
        ...light,
        value: 0, // Tất cả đèn có độ sáng 0%
      }));

      // Kiểm tra xem các group có liên tục không
      const isGroupContinuous = checkContinuousGroups(masterOffLights);

      if (isGroupContinuous) {
        // Nếu các group liên tục, sử dụng mode group liên tục
        const minGroup = Math.min(
          ...masterOffLights.map((light) => light.group)
        );
        scenes.push({
          name: `MASTER OFF ${cabinetIndex}`,
          amount: masterOffLights.length,
          lights: [{ name: "Đèn chưa đặt tên", group: minGroup, value: 0 }],
          isSequential: true,
          startGroup: minGroup,
        });
      } else {
        // Nếu các group không liên tục, sử dụng mode thông thường
        scenes.push({
          name: `MASTER OFF ${cabinetIndex}`,
          amount: masterOffLights.length,
          lights: masterOffLights,
          isSequential: false,
        });
      }
    }
  }

  // Tạo các scene OPEN/CLOSE
  Object.entries(openCloseLightsByNumber).forEach(([number, lightsObj]) => {
    // Tạo danh sách đèn cho scene OPEN
    const openSceneLights: Light[] = [];

    // Thêm đèn OPEN với độ sáng 100%
    lightsObj.open.forEach((light) => {
      openSceneLights.push({
        ...light,
        value: 100, // Đèn OPEN sáng 100% trong scene OPEN
      });
    });

    // Thêm đèn CLOSE với độ sáng 0%
    lightsObj.close.forEach((light) => {
      openSceneLights.push({
        ...light,
        value: 0, // Đèn CLOSE tắt (0%) trong scene OPEN
      });
    });

    // Sắp xếp đèn theo group
    openSceneLights.sort((a, b) => a.group - b.group);

    // Thêm scene OPEN mới
    if (openSceneLights.length > 0) {
      scenes.push({
        name: `OPEN ${number} ${cabinetIndex}`,
        amount: openSceneLights.length,
        lights: openSceneLights,
        isSequential: false,
      });
    }

    // Tạo danh sách đèn cho scene CLOSE
    const closeSceneLights: Light[] = [];

    // Thêm đèn OPEN với độ sáng 0%
    lightsObj.open.forEach((light) => {
      closeSceneLights.push({
        ...light,
        value: 0, // Đèn OPEN tắt (0%) trong scene CLOSE
      });
    });

    // Thêm đèn CLOSE với độ sáng 100%
    lightsObj.close.forEach((light) => {
      closeSceneLights.push({
        ...light,
        value: 100, // Đèn CLOSE sáng 100% trong scene CLOSE
      });
    });

    // Sắp xếp đèn theo group
    closeSceneLights.sort((a, b) => a.group - b.group);

    // Thêm scene CLOSE mới
    if (closeSceneLights.length > 0) {
      scenes.push({
        name: `CLOSE ${number} ${cabinetIndex}`,
        amount: closeSceneLights.length,
        lights: closeSceneLights,
        isSequential: false,
      });
    }
  });

  return { scenes, sceneTimeInfo };
}

/**
 * Tạo schedules từ danh sách scenes
 * @param scenes Danh sách scenes
 * @param sceneTimeInfo Thông tin thời gian của các scene (tùy chọn)
 * @returns Danh sách schedules
 */
function createSchedulesFromScenes(
  scenes: Scene[],
  sceneTimeInfo?: { [key: string]: { hour: number; minute: number } }
): Schedule[] {
  const schedules: Schedule[] = [];

  // Tạo map để nhóm các scene theo tên cơ bản (không có chỉ số tủ)
  const sceneGroups: { [key: string]: number[] } = {};

  // Tạo map để lưu trữ index của scene theo tên
  const sceneIndexMap: { [key: string]: number } = {};
  scenes.forEach((scene, index) => {
    sceneIndexMap[scene.name] = index;

    // Lấy tên cơ bản của scene (không có chỉ số tủ)
    const baseSceneName = scene.name.replace(/\s+\d+$/, "");

    if (!sceneGroups[baseSceneName]) {
      sceneGroups[baseSceneName] = [];
    }

    sceneGroups[baseSceneName].push(index + 1); // 1-based index for scene groups
  });

  // Tạo schedules cho các nhóm scene
  const defaultTimeMap: { [key: string]: { hour: number; minute: number } } = {
    "DAY TIME": { hour: 6, minute: 0 },
    "NIGHT TIME": { hour: 18, minute: 0 },
    "LATE TIME": { hour: 1, minute: 0 },
  };

  // Nếu đang sử dụng chế độ tủ riêng biệt (có sceneTimeInfo)
  if (sceneTimeInfo) {
    // Tạo map để nhóm các scene có cùng tên cơ bản và có thông tin thời gian
    const timeInfoByBaseScene: {
      [key: string]: { hour: number; minute: number };
    } = {};

    // Thu thập thông tin thời gian cho các scene cơ bản
    Object.entries(sceneTimeInfo).forEach(([sceneName, timeInfo]) => {
      // Lấy tên cơ bản của scene (không có chỉ số tủ)
      const baseSceneName = sceneName.replace(/\s+\d+$/, "");
      timeInfoByBaseScene[baseSceneName] = timeInfo;
    });

    // Chỉ tạo schedules cho các scene có thông tin thời gian
    Object.entries(sceneGroups).forEach(([baseSceneName, sceneIndices]) => {
      // Kiểm tra xem scene có thông tin thời gian không
      if (timeInfoByBaseScene[baseSceneName]) {
        const timeInfo = timeInfoByBaseScene[baseSceneName];

        schedules.push({
          name: baseSceneName,
          enable: true,
          sceneAmount: sceneIndices.length,
          sceneGroup: sceneIndices,
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
      }
    });
  } else {
    // Chế độ thông thường (không có sceneTimeInfo)
    // Tạo schedules cho các scene có trong defaultTimeMap
    Object.entries(defaultTimeMap).forEach(([sceneName, timeInfo]) => {
      // Kiểm tra xem có nhóm scene nào khớp với tên này không
      if (sceneGroups[sceneName]) {
        schedules.push({
          name: sceneName,
          enable: true,
          sceneAmount: sceneGroups[sceneName].length,
          sceneGroup: sceneGroups[sceneName],
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
      }
    });

    // Tạo schedules cho các nhóm scene khác
    Object.entries(sceneGroups).forEach(([baseSceneName, sceneIndices]) => {
      // Bỏ qua các scene đã xử lý trong defaultTimeMap
      if (Object.keys(defaultTimeMap).includes(baseSceneName)) {
        return;
      }

      // Xác định thời gian dựa trên tên scene
      let hour = 12;
      // eslint-disable-next-line prefer-const
      let minute = 0;

      if (baseSceneName.toUpperCase().includes("DAY")) {
        hour = 6;
      } else if (baseSceneName.toUpperCase().includes("NIGHT")) {
        hour = 18;
      } else if (baseSceneName.toUpperCase().includes("LATE")) {
        hour = 1;
      }

      // Kiểm tra xem schedule này đã tồn tại chưa
      const existingSchedule = schedules.find((s) => s.name === baseSceneName);
      if (!existingSchedule) {
        schedules.push({
          name: baseSceneName,
          enable: true,
          sceneAmount: sceneIndices.length,
          sceneGroup: sceneIndices,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
          hour,
          minute,
        });
      }
    });
  }

  return schedules;
}
