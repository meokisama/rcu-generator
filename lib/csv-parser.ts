import { Light, Scene, Schedule } from "@/types/app-types";
import csvParser from "csv-parser";
import { Readable } from "stream";

/**
 * Parse CSV content and convert it to scenes and schedules
 * @param csvContent The CSV file content as string
 * @returns Object containing scenes and schedules
 */
export function parseCSV(csvContent: string): Promise<{
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
            const processedData = processCSVData(results);
            resolve(processedData);
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

  Object.entries(rows[sceneNameRow]).forEach(([key, value]) => {
    if (
      value &&
      typeof value === "string" &&
      value.trim() !== "" &&
      !value.includes(":")
    ) {
      const sceneName = value.trim();
      sceneColumns[sceneName] = parseInt(key);
      sceneNames.push(sceneName);
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
    const groupMatch = row[groupColumn].toString().match(/GROUP\s+(\d+)/i);
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
      if (colIndex !== undefined && row[colIndex]) {
        let value = row[colIndex].toString().trim();

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

        const brightness = parseInt(value);
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

      const value = lightInfo.values[sceneName] || 100;

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

  // Kiểm tra xem có scene MASTER ON/OFF không
  const masterOnOffIndex = sceneNames.findIndex(
    (name) =>
      name.toUpperCase() === "MASTER ON/OFF" ||
      name.toUpperCase() === "MASTER ON-OFF" ||
      name.toUpperCase() === "MASTER ON OFF"
  );

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

      const value = lightInfo.values[scene.name] || 100;

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
  });

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

  // Nếu có scene MASTER ON/OFF, tạo hai scene MASTER ON và MASTER OFF
  if (masterOnOffIndex !== -1) {
    // Tạo scene MASTER ON
    if (allLights.length > 0) {
      const masterOnLights = allLights.map((light) => ({
        ...light,
        value: 100, // Tất cả đèn có độ sáng 100%
      }));

      scenes.push({
        name: "MASTER ON",
        amount: masterOnLights.length,
        lights: masterOnLights,
        isSequential: false,
      });
    }

    // Tạo scene MASTER OFF
    if (allLights.length > 0) {
      const masterOffLights = allLights.map((light) => ({
        ...light,
        value: 0, // Tất cả đèn có độ sáng 0%
      }));

      scenes.push({
        name: "MASTER OFF",
        amount: masterOffLights.length,
        lights: masterOffLights,
        isSequential: false,
      });
    }
  }

  // Tạo schedules cho DAY TIME, NIGHT TIME, và LATE TIME nếu có
  const schedules: Schedule[] = [];
  const timeMap: { [key: string]: { hour: number; minute: number } } = {
    "DAY TIME": { hour: 6, minute: 0 },
    "NIGHT TIME": { hour: 18, minute: 0 },
    "LATE TIME": { hour: 1, minute: 0 },
  };

  // Tạo map để lưu trữ index của scene theo tên
  const sceneIndexMap: { [key: string]: number } = {};
  scenes.forEach((scene, index) => {
    sceneIndexMap[scene.name] = index;
  });

  // Tạo schedules cho các scene có trong timeMap
  Object.entries(timeMap).forEach(([sceneName, timeInfo]) => {
    // Kiểm tra xem scene có tồn tại không
    if (sceneIndexMap[sceneName] !== undefined) {
      schedules.push({
        name: sceneName,
        enable: true,
        sceneAmount: 1,
        sceneGroup: [sceneIndexMap[sceneName] + 1], // 1-based index for scene groups
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

  // Kiểm tra xem có scene nào trong sceneNames khớp với các scene thời gian không
  sceneNames.forEach((sceneName) => {
    // Kiểm tra xem scene có phải là scene thời gian không
    const isTimeScene = Object.keys(timeMap).some((timeName) =>
      sceneName.toUpperCase().includes(timeName.toUpperCase())
    );

    // Nếu là scene thời gian và chưa có trong schedules
    if (isTimeScene && sceneIndexMap[sceneName] !== undefined) {
      // Xác định thời gian dựa trên tên scene
      let hour = 12;
      // eslint-disable-next-line prefer-const
      let minute = 0;

      if (sceneName.toUpperCase().includes("DAY")) {
        hour = 6;
      } else if (sceneName.toUpperCase().includes("NIGHT")) {
        hour = 18;
      } else if (sceneName.toUpperCase().includes("LATE")) {
        hour = 1;
      }

      // Kiểm tra xem schedule này đã tồn tại chưa
      const existingSchedule = schedules.find((s) => s.name === sceneName);
      if (!existingSchedule) {
        schedules.push({
          name: sceneName,
          enable: true,
          sceneAmount: 1,
          sceneGroup: [sceneIndexMap[sceneName] + 1], // 1-based index for scene groups
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
    }
  });

  return { scenes, schedules };
}
