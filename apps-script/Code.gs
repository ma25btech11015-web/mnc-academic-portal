/**
 * Google Apps Script API for the MNC Academic Portal.
 *
 * Web app:
 * Execute as: Me
 * Who has access: Anyone with the link
 *
 * The Google Sheet remains private. Classroom data is only exposed for
 * courses explicitly mapped in CLASSROOM_COURSES.
 */

const ALLOWED_SHEETS = new Set([
  'SETTINGS',
  'TIMETABLE',
  'COURSES',
  'ASSESSMENTS',
  'RESOURCES',
  'ACADEMIC_EVENTS',
  'REMINDER_SETTINGS',
  'ANNOUNCEMENTS',
  'OTHER_ANNOUNCEMENTS'
]);

function doGet(e) {
  const params = e?.parameter || {};
  const action = String(params.action || '').trim();
  const sheetName = String(params.sheet || '').trim();
  const callback = String(params.callback || '').trim();

  if (action === 'classroom') {
    const courseId = String(params.courseId || '').trim();
    if (!courseId) return output({ error: 'Missing courseId' }, callback);
    try {
      return output(getClassroomData(courseId), callback);
    } catch (error) {
      return output({ error: error.message || String(error) }, callback);
    }
  }

  if (!ALLOWED_SHEETS.has(sheetName)) {
    return output({ error: 'Invalid sheet' }, callback);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return output({ error: 'Sheet not found' }, callback);

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return output([], callback);

  const headers = values.shift();
  const rows = values.filter(row => row.some(Boolean)).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      if (header) obj[header] = row[index] ?? '';
    });
    return obj;
  });

  return output(rows, callback);
}

function output(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
    return ContentService.createTextOutput(`${callback}(${json})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function getClassroomMapping() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CLASSROOM_COURSES');
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values.shift();
  const courseIdIndex = headers.indexOf('Course ID');
  const classroomIdIndex = headers.indexOf('Classroom Course ID');
  const activeIndex = headers.indexOf('Active');

  if (courseIdIndex === -1 || classroomIdIndex === -1) {
    throw new Error('CLASSROOM_COURSES must contain Course ID and Classroom Course ID');
  }

  return values
    .filter(row => row[courseIdIndex] && row[classroomIdIndex])
    .filter(row => activeIndex === -1 || String(row[activeIndex]).trim().toUpperCase() === 'TRUE')
    .map(row => ({
      courseId: String(row[courseIdIndex]).trim(),
      classroomCourseId: String(row[classroomIdIndex]).trim()
    }));
}

function findClassroomCourse(courseId) {
  const normalized = String(courseId).trim().toUpperCase();
  return getClassroomMapping().find(item => item.courseId.toUpperCase() === normalized) || null;
}

function getClassroomData(courseId) {
  const match = findClassroomCourse(courseId);

  if (!match) {
    return {
      courseId,
      classroomConnected: false,
      classroomCourseId: '',
      announcements: [],
      coursework: [],
      materials: []
    };
  }

  return {
    courseId,
    classroomConnected: true,
    classroomCourseId: match.classroomCourseId,
    announcements: getClassroomAnnouncements(match.classroomCourseId),
    coursework: getClassroomCoursework(match.classroomCourseId),
    materials: getClassroomMaterials(match.classroomCourseId)
  };
}

function getClassroomAnnouncements(classroomCourseId) {
  const result = [];
  let pageToken = null;

  do {
    const options = { pageSize: 100 };
    if (pageToken) options.pageToken = pageToken;

    const response = Classroom.Courses.Announcements.list(classroomCourseId, options);
    (response.announcements || []).forEach(item => {
      if (String(item.state || 'PUBLISHED').toUpperCase() !== 'PUBLISHED') return;
      result.push({
        id: item.id || '',
        text: item.text || '',
        creationTime: item.creationTime || '',
        updateTime: item.updateTime || '',
        alternateLink: item.alternateLink || '',
        state: item.state || 'PUBLISHED'
      });
    });

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return result.sort((a, b) => String(b.creationTime).localeCompare(String(a.creationTime)));
}

function getClassroomCoursework(classroomCourseId) {
  const result = [];
  let pageToken = null;

  do {
    const options = { pageSize: 100 };
    if (pageToken) options.pageToken = pageToken;

    const response = Classroom.Courses.CourseWork.list(classroomCourseId, options);
    (response.courseWork || []).forEach(item => {
      result.push({
        id: item.id || '',
        title: item.title || '',
        description: item.description || '',
        workType: item.workType || 'ASSIGNMENT',
        state: item.state || '',
        dueDate: item.dueDate || null,
        dueTime: item.dueTime || null,
        maxPoints: item.maxPoints ?? null,
        alternateLink: item.alternateLink || '',
        materials: item.materials || []
      });
    });

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return result.sort((a, b) => {
    const da = a.dueDate ? `${a.dueDate.year}-${a.dueDate.month}-${a.dueDate.day}` : '9999-99-99';
    const db = b.dueDate ? `${b.dueDate.year}-${b.dueDate.month}-${b.dueDate.day}` : '9999-99-99';
    return da.localeCompare(db);
  });
}

function getClassroomMaterials(classroomCourseId) {
  const result = [];
  let pageToken = null;

  do {
    const options = { pageSize: 100 };
    if (pageToken) options.pageToken = pageToken;

    const response = Classroom.Courses.CourseWorkMaterials.list(classroomCourseId, options);
    (response.courseWorkMaterial || []).forEach(item => {
      result.push({
        id: item.id || '',
        title: item.title || '',
        description: item.description || '',
        state: item.state || '',
        alternateLink: item.alternateLink || '',
        materials: item.materials || []
      });
    });

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return result;
}
