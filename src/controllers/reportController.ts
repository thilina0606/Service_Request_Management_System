import { Response } from 'express';
import { db } from '../db/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { RequestStatus, RequestDepartment, ALL_DEPARTMENTS } from '../types';
import pdfMake from 'pdfmake';
import ExcelJS from 'exceljs';

// Define standard fonts for PDFMake to run purely in-memory without disk dependencies
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

pdfMake.fonts = fonts;

/**
 * Filter requests array by requested filters: date range, department, status
 */
function getFilteredRequests(query: any) {
  const { dateRange, startDate, endDate, department, status } = query;
  let requests = db.getRequests();
  const allUsers = db.getUsers();

  // Populate creator names and find latest admin comments
  let mappedRequests = requests.map(r => {
    const creator = allUsers.find(u => u.id === r.created_by);
    const logs = db.getActivityLogs(r.id);
    
    // Find latest admin log to extract admin comments
    const adminLogs = logs
      .filter(l => l.role === 'Admin')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    let adminComments = 'No comments';
    if (adminLogs.length > 0) {
      const latest = adminLogs[0];
      // Try to extract comments if present in description
      if (latest.description.includes('Comment:')) {
        adminComments = latest.description.split('Comment:')[1].trim();
      } else if (latest.description.includes('"')) {
        const matches = latest.description.match(/"([^"]+)"/);
        adminComments = matches ? matches[1] : latest.description;
      } else {
        adminComments = latest.description;
      }
    }

    return {
      ...r,
      creator_name: creator ? creator.name : 'Unknown User',
      creator_email: creator ? creator.email : 'unknown@example.com',
      adminComments
    };
  });

  // 1. Department Filter
  if (department && department !== 'All') {
    mappedRequests = mappedRequests.filter(r => r.department === department);
  }

  // 2. Status Filter
  if (status && status !== 'All') {
    mappedRequests = mappedRequests.filter(r => r.status === status);
  }

  // 3. Date Range Filter
  const now = new Date();
  if (dateRange) {
    if (dateRange === 'Today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      mappedRequests = mappedRequests.filter(r => new Date(r.created_at) >= startOfToday);
    } else if (dateRange === 'Last 7 Days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      mappedRequests = mappedRequests.filter(r => new Date(r.created_at) >= sevenDaysAgo);
    } else if (dateRange === 'Last 30 Days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      mappedRequests = mappedRequests.filter(r => new Date(r.created_at) >= thirtyDaysAgo);
    } else if (dateRange === 'This Month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      mappedRequests = mappedRequests.filter(r => new Date(r.created_at) >= startOfMonth);
    } else if (dateRange === 'Custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // include entire end day
      mappedRequests = mappedRequests.filter(r => {
        const d = new Date(r.created_at);
        return d >= start && d <= end;
      });
    }
  }

  // Sort by created_at descending
  mappedRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return mappedRequests;
}

/**
 * Computes general summaries and counts for departments/status
 */
function compileReportStats(requests: any[]) {
  // Overall status count
  const total = requests.length;
  const pendingInventoryReview = requests.filter(r => r.status === 'Pending Inventory Review').length;
  const pendingAdminApproval = requests.filter(r => r.status === 'Pending Admin Approval').length;
  const approved = requests.filter(r => r.status === 'Approved').length;
  const rejected = requests.filter(r => r.status === 'Rejected').length;
  const needMoreInfo = requests.filter(r => r.status === 'Need More Information').length;
  const completed = requests.filter(r => r.status === 'Completed').length;

  // Completed Stats
  const completedRequests = requests.filter(r => r.status === 'Completed');
  const completedCount = completedRequests.length;

  const completedByDept: Record<string, number> = {};
  ALL_DEPARTMENTS.forEach(dept => {
    completedByDept[dept] = 0;
  });
  completedRequests.forEach(r => {
    if (r.department in completedByDept) {
      completedByDept[r.department]++;
    }
  });

  const completedByMonth: Record<string, number> = {};
  completedRequests.forEach(r => {
    if (r.completed_at) {
      const d = new Date(r.completed_at);
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      completedByMonth[label] = (completedByMonth[label] || 0) + 1;
    }
  });

  const completedByUser: Record<string, number> = {};
  completedRequests.forEach(r => {
    const userName = r.creator_name || 'Unknown';
    completedByUser[userName] = (completedByUser[userName] || 0) + 1;
  });

  let latestCompletionDate = 'N/A';
  if (completedRequests.length > 0) {
    const sortedCompleted = [...completedRequests].sort(
      (a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
    );
    if (sortedCompleted[0].completed_at) {
      latestCompletionDate = new Date(sortedCompleted[0].completed_at).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  }

  // Department counts
  const getDeptStats = (dept: string) => {
    const deptRequests = requests.filter(r => r.department === dept);
    const dTotal = deptRequests.length;
    const dApproved = deptRequests.filter(r => r.status === 'Approved').length;
    const dRejected = deptRequests.filter(r => r.status === 'Rejected').length;
    // Pending = Pending Inventory Review + Pending Admin Approval + Need More Information
    const dPending = deptRequests.filter(r => 
      r.status === 'Pending Inventory Review' || r.status === 'Pending Admin Approval' || r.status === 'Need More Information'
    ).length;

    return {
      total: dTotal,
      approved: dApproved,
      rejected: dRejected,
      pending: dPending
    };
  };

  // Monthly trend for the last 6 months
  const monthlyTrendMap: Record<string, number> = {};
  const last6Months: string[] = [];
  const tempDate = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(tempDate.getFullYear(), tempDate.getMonth() - i, 1);
    const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    last6Months.push(label);
    monthlyTrendMap[label] = 0;
  }

  requests.forEach(r => {
    const d = new Date(r.created_at);
    const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    if (label in monthlyTrendMap) {
      monthlyTrendMap[label]++;
    }
  });

  const monthlyTrend = last6Months.map(month => ({
    month,
    count: monthlyTrendMap[month]
  }));

  const departmentSummary = ALL_DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = getDeptStats(dept);
    return acc;
  }, {} as Record<string, any>);

  const byDepartment = ALL_DEPARTMENTS.map(dept => ({
    name: dept,
    count: requests.filter(r => r.department === dept).length
  }));

  return {
    summary: { total, pendingInventoryReview, pendingAdminApproval, approved, rejected, needMoreInfo, completed },
    completedStats: {
      completedCount,
      byDept: completedByDept,
      byMonth: completedByMonth,
      byUser: completedByUser,
      latestCompletionDate
    },
    departmentSummary,
    charts: {
      byStatus: [
        { name: 'Pending Inventory Review', count: pendingInventoryReview },
        { name: 'Pending Admin Approval', count: pendingAdminApproval },
        { name: 'Approved', count: approved },
        { name: 'Rejected', count: rejected },
        { name: 'Need More Info', count: needMoreInfo },
        { name: 'Completed', count: completed }
      ],
      byDepartment,
      monthlyTrend
    }
  };
}

/**
 * GET /api/admin/reports/summary
 * Returns report filters, status metrics, department breakdown, trend, and the request details
 */
export async function getReportSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const requests = getFilteredRequests(req.query);
    const stats = compileReportStats(requests);

    return res.status(200).json({
      filters: {
        dateRange: req.query.dateRange || 'All',
        department: req.query.department || 'All',
        status: req.query.status || 'All',
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null
      },
      ...stats,
      requests
    });
  } catch (error: any) {
    console.error('Report summary compilation error:', error);
    return res.status(500).json({ message: 'Internal server error compiling report summary' });
  }
}

/**
 * GET /api/admin/reports/pdf
 * Generates an elegant A4 PDF report with custom design and tables using pdfmake
 */
export async function getReportPdf(req: AuthenticatedRequest, res: Response) {
  try {
    const adminName = req.user?.name || 'Admin Manager';
    const requests = getFilteredRequests(req.query);
    const stats = compileReportStats(requests);

    const activeRequests = requests.filter(r => r.status !== 'Completed');
    const completedRequests = requests.filter(r => r.status === 'Completed');

    // Get inventory transactions linked to these filtered requests
    const requestIds = requests.map(r => r.id);
    const transactions = db.getInventoryTransactions().filter(tx => requestIds.includes(tx.request_id));

    const dateRangeLabel = req.query.dateRange === 'Custom'
      ? `${req.query.startDate} to ${req.query.endDate}`
      : (req.query.dateRange || 'All Time');

    // Build pdfmake document structure
    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [30, 40, 30, 40],
      defaultStyle: {
        font: 'Helvetica'
      },
      content: [
        // Top colored accent bar
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 535, h: 6, color: '#10b981' }],
          margin: [0, 0, 0, 15]
        },
        // Header Layout
        {
          columns: [
            {
              text: 'PSR REQUEST MANAGEMENT SYSTEM',
              fontSize: 16,
              bold: true,
              color: '#111827'
            },
            {
              text: 'SUMMARY REPORT',
              fontSize: 14,
              bold: true,
              color: '#6b7280',
              alignment: 'right'
            }
          ]
        },
        { text: 'SYSTEM ADMINISTRATION DASHBOARD', fontSize: 9, color: '#9ca3af', margin: [0, 2, 0, 15] },
        
        // Metadata Table
        {
          table: {
            widths: ['35%', '65%'],
            body: [
              [
                { text: 'Generated Date & Time:', bold: true, fontSize: 10, color: '#4b5563' },
                { text: new Date().toLocaleString(), fontSize: 10, color: '#111827' }
              ],
              [
                { text: 'Generated By:', bold: true, fontSize: 10, color: '#4b5563' },
                { text: adminName, fontSize: 10, color: '#111827' }
              ],
              [
                { text: 'Filters Applied:', bold: true, fontSize: 10, color: '#4b5563' },
                { 
                  text: `Date Range: ${dateRangeLabel} | Department: ${req.query.department || 'All'} | Status: ${req.query.status || 'All'}`,
                  fontSize: 10, 
                  color: '#111827' 
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 25]
        },

        // Section Title: Overall Summary
        { text: 'OVERALL REQUESTS SUMMARY', fontSize: 12, bold: true, color: '#1f2937', margin: [0, 0, 0, 10] },
        
        // Summary Cards Grid (Implemented as 7 columns)
        {
          table: {
            widths: ['14%', '14%', '14%', '14%', '14%', '15%', '15%'],
            body: [
              [
                { text: 'Total Requests', bold: true, alignment: 'center', fontSize: 8, fillColor: '#f3f4f6', margin: [4, 6, 4, 6] },
                { text: 'Pending Inv. Rev.', bold: true, alignment: 'center', fontSize: 8, fillColor: '#eff6ff', margin: [4, 6, 4, 6] },
                { text: 'Pending Admin Appr.', bold: true, alignment: 'center', fontSize: 8, fillColor: '#fef3c7', margin: [4, 6, 4, 6] },
                { text: 'Approved', bold: true, alignment: 'center', fontSize: 8, fillColor: '#ecfdf5', margin: [4, 6, 4, 6] },
                { text: 'Rejected', bold: true, alignment: 'center', fontSize: 8, fillColor: '#fef2f2', margin: [4, 6, 4, 6] },
                { text: 'Need Info', bold: true, alignment: 'center', fontSize: 8, fillColor: '#fbf2ff', margin: [4, 6, 4, 6] },
                { text: 'Completed', bold: true, alignment: 'center', fontSize: 8, fillColor: '#f5f3ff', margin: [4, 6, 4, 6] }
              ],
              [
                { text: String(stats.summary?.total ?? 0), alignment: 'center', fontSize: 12, bold: true, margin: [4, 8, 4, 8] },
                { text: String(stats.summary?.pendingInventoryReview ?? 0), alignment: 'center', fontSize: 12, bold: true, color: '#2563eb', margin: [4, 8, 4, 8] },
                { text: String(stats.summary?.pendingAdminApproval ?? 0), alignment: 'center', fontSize: 12, bold: true, color: '#d97706', margin: [4, 8, 4, 8] },
                { text: String(stats.summary?.approved ?? 0), alignment: 'center', fontSize: 12, bold: true, color: '#059669', margin: [4, 8, 4, 8] },
                { text: String(stats.summary?.rejected ?? 0), alignment: 'center', fontSize: 12, bold: true, color: '#dc2626', margin: [4, 8, 4, 8] },
                { text: String(stats.summary?.needMoreInfo ?? 0), alignment: 'center', fontSize: 12, bold: true, color: '#7c3aed', margin: [4, 8, 4, 8] },
                { text: String(stats.summary?.completed ?? 0), alignment: 'center', fontSize: 12, bold: true, color: '#4f46e5', margin: [4, 8, 4, 8] }
              ]
            ]
          },
          margin: [0, 0, 0, 25]
        },

        // Section Title: Department Breakdown
        { text: 'DEPARTMENT BREAKDOWN SUMMARY', fontSize: 12, bold: true, color: '#1f2937', margin: [0, 0, 0, 10] },
        {
          table: {
            widths: ['40%', '20%', '20%', '20%'],
            body: [
              [
                { text: 'Department Name', bold: true, fillColor: '#e5e7eb', fontSize: 10, margin: [8, 6, 8, 6] },
                { text: 'Total Requests', bold: true, fillColor: '#e5e7eb', fontSize: 10, alignment: 'center', margin: [8, 6, 8, 6] },
                { text: 'Approved', bold: true, fillColor: '#e5e7eb', fontSize: 10, alignment: 'center', margin: [8, 6, 8, 6] },
                { text: 'Rejected', bold: true, fillColor: '#e5e7eb', fontSize: 10, alignment: 'center', margin: [8, 6, 8, 6] }
              ],
              ...ALL_DEPARTMENTS.map(dept => [
                { text: `${dept} Department`, fontSize: 10, margin: [8, 4, 8, 4] },
                { text: (stats.departmentSummary[dept]?.total || 0).toString(), fontSize: 10, alignment: 'center', margin: [8, 4, 8, 4] },
                { text: (stats.departmentSummary[dept]?.approved || 0).toString(), fontSize: 10, alignment: 'center', color: '#059669', margin: [8, 4, 8, 4] },
                { text: (stats.departmentSummary[dept]?.rejected || 0).toString(), fontSize: 10, alignment: 'center', color: '#dc2626', margin: [8, 4, 8, 4] }
              ])
            ]
          },
          margin: [0, 0, 0, 25]
        },

        // Section Title: Active Request Details Table
        { text: 'DETAILED ACTIVE REQUEST LIST', fontSize: 12, bold: true, color: '#1f2937', margin: [0, 0, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['10%', '22%', '14%', '10%', '16%', '13%', '15%'],
            body: [
              [
                { text: 'ID', bold: true, fillColor: '#374151', color: '#ffffff', fontSize: 8, alignment: 'center' },
                { text: 'Title', bold: true, fillColor: '#374151', color: '#ffffff', fontSize: 8 },
                { text: 'Dept', bold: true, fillColor: '#374151', color: '#ffffff', fontSize: 8, alignment: 'center' },
                { text: 'Priority', bold: true, fillColor: '#374151', color: '#ffffff', fontSize: 8, alignment: 'center' },
                { text: 'Status', bold: true, fillColor: '#374151', color: '#ffffff', fontSize: 8, alignment: 'center' },
                { text: 'Requested By', bold: true, fillColor: '#374151', color: '#ffffff', fontSize: 8 },
                { text: 'Admin Comments', bold: true, fillColor: '#374151', color: '#ffffff', fontSize: 8 }
              ],
              ...(activeRequests.length === 0 ? [
                [
                  { text: 'No active requests found matching the filters.', colSpan: 7, alignment: 'center', fontSize: 8, margin: [2, 4, 2, 4] },
                  {}, {}, {}, {}, {}, {}
                ]
              ] : activeRequests.map(r => {
                let statusColor = '#3b82f6';
                if (r.status === 'Approved') statusColor = '#10b981';
                else if (r.status === 'Rejected') statusColor = '#ef4444';
                else if (r.status === 'Pending Inventory Review') statusColor = '#f59e0b';
                else if (r.status === 'Pending Admin Approval') statusColor = '#8b5cf6';
                else if (r.status === 'Need More Information') statusColor = '#8b5cf6';

                return [
                  { text: r.id, fontSize: 7, alignment: 'center', margin: [2, 4, 2, 4] },
                  { text: r.title, fontSize: 7, bold: true, margin: [2, 4, 2, 4] },
                  { text: r.department, fontSize: 7, alignment: 'center', margin: [2, 4, 2, 4] },
                  { text: r.priority, fontSize: 7, alignment: 'center', margin: [2, 4, 2, 4] },
                  { text: r.status, fontSize: 7, bold: true, color: statusColor, alignment: 'center', margin: [2, 4, 2, 4] },
                  { text: r.creator_name || 'Unknown', fontSize: 7, margin: [2, 4, 2, 4] },
                  { text: r.adminComments || 'No comments', fontSize: 7, margin: [2, 4, 2, 4] }
                ];
              }))
            ]
          },
          margin: [0, 0, 0, 15]
        },

        // Section Title: Completed Request Details Table
        { text: 'COMPLETED REQUEST LIST', fontSize: 12, bold: true, color: '#10b981', margin: [0, 15, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['10%', '22%', '14%', '10%', '16%', '13%', '15%'],
            body: [
              [
                { text: 'ID', bold: true, fillColor: '#10b981', color: '#ffffff', fontSize: 8, alignment: 'center' },
                { text: 'Title', bold: true, fillColor: '#10b981', color: '#ffffff', fontSize: 8 },
                { text: 'Dept', bold: true, fillColor: '#10b981', color: '#ffffff', fontSize: 8, alignment: 'center' },
                { text: 'Priority', bold: true, fillColor: '#10b981', color: '#ffffff', fontSize: 8, alignment: 'center' },
                { text: 'Completed By', bold: true, fillColor: '#10b981', color: '#ffffff', fontSize: 8 },
                { text: 'Completion Date', bold: true, fillColor: '#10b981', color: '#ffffff', fontSize: 8 },
                { text: 'Admin Comments', bold: true, fillColor: '#10b981', color: '#ffffff', fontSize: 8 }
              ],
              ...(completedRequests.length === 0 ? [
                [
                  { text: 'No completed requests found matching the filters.', colSpan: 7, alignment: 'center', fontSize: 8, margin: [2, 4, 2, 4] },
                  {}, {}, {}, {}, {}, {}
                ]
              ] : completedRequests.map(r => {
                return [
                  { text: r.id, fontSize: 7, alignment: 'center', margin: [2, 4, 2, 4] },
                  { text: r.title, fontSize: 7, bold: true, margin: [2, 4, 2, 4] },
                  { text: r.department, fontSize: 7, alignment: 'center', margin: [2, 4, 2, 4] },
                  { text: r.priority, fontSize: 7, alignment: 'center', margin: [2, 4, 2, 4] },
                  { text: r.creator_name || 'Unknown', fontSize: 7, margin: [2, 4, 2, 4] },
                  { text: r.completed_at ? new Date(r.completed_at).toLocaleDateString() : 'N/A', fontSize: 7, margin: [2, 4, 2, 4] },
                  { text: r.adminComments || 'No comments', fontSize: 7, margin: [2, 4, 2, 4] }
                ];
              }))
            ]
          },
          margin: [0, 0, 0, 15]
        },

        // Section Title: Materials Used Details Table
        { text: 'MATERIALS USED SUMMARY (COMPLETED WORK)', fontSize: 12, bold: true, color: '#2563eb', margin: [0, 15, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['25%', '15%', '18%', '20%', '22%'],
            body: [
              [
                { text: 'Item Name', bold: true, fillColor: '#2563eb', color: '#ffffff', fontSize: 8 },
                { text: 'Quantity Used', bold: true, fillColor: '#2563eb', color: '#ffffff', fontSize: 8, alignment: 'center' },
                { text: 'Completion Date', bold: true, fillColor: '#2563eb', color: '#ffffff', fontSize: 8, alignment: 'center' },
                { text: 'Department', bold: true, fillColor: '#2563eb', color: '#ffffff', fontSize: 8 },
                { text: 'User', bold: true, fillColor: '#2563eb', color: '#ffffff', fontSize: 8 }
              ],
              ...(transactions.length === 0 ? [
                [
                  { text: 'No materials used found matching the filters.', colSpan: 5, alignment: 'center', fontSize: 8, margin: [2, 4, 2, 4] },
                  {}, {}, {}, {}
                ]
              ] : transactions.map(tx => {
                return [
                  { text: tx.item_name, fontSize: 7, bold: true, margin: [2, 4, 2, 4] },
                  { text: String(tx.quantity ?? 0), fontSize: 7, alignment: 'center', margin: [2, 4, 2, 4] },
                  { text: tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'N/A', fontSize: 7, alignment: 'center', margin: [2, 4, 2, 4] },
                  { text: tx.item_type || 'N/A', fontSize: 7, margin: [2, 4, 2, 4] },
                  { text: tx.performed_by || 'Unknown', fontSize: 7, margin: [2, 4, 2, 4] }
                ];
              }))
            ]
          },
          margin: [0, 0, 0, 15]
        },
        
        { text: `* Summary includes ${requests.length} total request records after filtering.`, fontSize: 8, italics: true, color: '#6b7280' }
      ],
      footer: (currentPage: number, pageCount: number) => {
        return {
          columns: [
            { text: 'Confidential | PSR Request Management System', fontSize: 8, color: '#9ca3af', margin: [30, 0, 0, 0] },
            { text: `Page ${currentPage} of ${pageCount}`, fontSize: 8, color: '#9ca3af', alignment: 'right', margin: [0, 0, 30, 0] }
          ]
        };
      }
    };

    const pdfDoc = pdfMake.createPdf(docDefinition);
    const bufferResult = await pdfDoc.getBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PSR_Report_${Date.now()}.pdf"`);
    return res.status(200).send(bufferResult);
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return res.status(500).json({ message: 'Internal server error generating PDF report' });
  }
}

/**
 * GET /api/admin/reports/excel
 * Generates an Excel report using exceljs
 */
export async function getReportExcel(req: AuthenticatedRequest, res: Response) {
  try {
    const adminName = req.user?.name || 'Admin Manager';
    const requests = getFilteredRequests(req.query);
    const stats = compileReportStats(requests);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PSR Request Management System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Summary Report');

    // Title Block
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'PSR REQUEST MANAGEMENT SYSTEM - SUMMARY REPORT';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 40;

    // Metadata Info Block
    sheet.getCell('A3').value = 'Generated At:';
    sheet.getCell('A3').font = { bold: true };
    sheet.getCell('B3').value = new Date().toLocaleString();

    sheet.getCell('A4').value = 'Generated By:';
    sheet.getCell('A4').font = { bold: true };
    sheet.getCell('B4').value = adminName;

    sheet.getCell('A5').value = 'Filters Applied:';
    sheet.getCell('A5').font = { bold: true };
    sheet.getCell('B5').value = `Date Range: ${req.query.dateRange || 'All'} | Dept: ${req.query.department || 'All'} | Status: ${req.query.status || 'All'}`;

    // Overall Counts Block
    sheet.getCell('A7').value = 'OVERALL SUMMARY STATS';
    sheet.getCell('A7').font = { size: 12, bold: true };

    const headersRow = ['Metric', 'Count', '', 'Department Summary', 'Total Requests', 'Approved', 'Rejected', 'Pending'];
    sheet.addRow(headersRow);
    const headerIndex = sheet.lastRow!.number;
    sheet.getRow(headerIndex).font = { bold: true };

    const overallMetrics = [
      ['Total Requests', stats.summary.total],
      ['Pending Inventory Review', stats.summary.pendingInventoryReview],
      ['Pending Admin Approval', stats.summary.pendingAdminApproval],
      ['Approved', stats.summary.approved],
      ['Rejected', stats.summary.rejected],
      ['Need More Info', stats.summary.needMoreInfo],
      ['Completed', stats.summary.completed]
    ];

    const rowData: any[] = [];
    const maxRows = Math.max(overallMetrics.length, ALL_DEPARTMENTS.length);

    for (let i = 0; i < maxRows; i++) {
      const metricCol = overallMetrics[i] || ['', ''];
      const deptName = ALL_DEPARTMENTS[i];
      const deptCols = deptName 
        ? [
            deptName, 
            stats.departmentSummary[deptName]?.total || 0,
            stats.departmentSummary[deptName]?.approved || 0,
            stats.departmentSummary[deptName]?.rejected || 0,
            stats.departmentSummary[deptName]?.pending || 0
          ]
        : ['', '', '', '', ''];
      
      rowData.push([
        metricCol[0],
        metricCol[1],
        '',
        ...deptCols
      ]);
    }

    rowData.forEach(r => sheet.addRow(r));

    // Space before Requests Table
    sheet.addRow([]);
    sheet.addRow([]);

    // Requests Table
    const tableHeader = ['Request ID', 'Title', 'Department', 'Priority', 'Status', 'Requested By', 'Submitted Date', 'Last Updated', 'Admin Comments'];
    sheet.addRow(tableHeader);
    const tableHeaderIndex = sheet.lastRow!.number;
    const headerRowCells = sheet.getRow(tableHeaderIndex);
    headerRowCells.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRowCells.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    });

    requests.forEach(r => {
      sheet.addRow([
        r.id,
        r.title,
        r.department,
        r.priority,
        r.status,
        r.creator_name || 'Unknown',
        new Date(r.created_at).toLocaleString(),
        new Date(r.updated_at).toLocaleString(),
        r.adminComments || 'No comments'
      ]);
    });

    // Auto-fit Columns width
    sheet.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell!({ includeEmpty: true }, (cell) => {
        const value = cell.value ? cell.value.toString() : '';
        maxLen = Math.max(maxLen, value.length);
      });
      column.width = Math.min(Math.max(maxLen + 4, 12), 45);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PSR_Excel_Report_${Date.now()}.xlsx"`);

    const buffer = await workbook.xlsx.writeBuffer();
    return res.status(200).send(buffer);
  } catch (error: any) {
    console.error('Excel generation error:', error);
    return res.status(500).json({ message: 'Internal server error generating Excel report' });
  }
}

/**
 * GET /api/admin/reports/csv
 * Generates a clean CSV report using standard JS string joining
 */
export async function getReportCsv(req: AuthenticatedRequest, res: Response) {
  try {
    const requests = getFilteredRequests(req.query);

    const headers = [
      'Request ID',
      'Title',
      'Department',
      'Priority',
      'Status',
      'Requested By',
      'Submitted Date',
      'Last Updated',
      'Admin Comments'
    ];

    const csvRows = [headers.join(',')];

    requests.forEach(r => {
      const row = [
        r.id,
        `"${r.title.replace(/"/g, '""')}"`,
        r.department,
        r.priority,
        r.status,
        `"${(r.creator_name || 'Unknown').replace(/"/g, '""')}"`,
        `"${new Date(r.created_at).toISOString()}"`,
        `"${new Date(r.updated_at).toISOString()}"`,
        `"${(r.adminComments || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="PSR_CSV_Report_${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('CSV generation error:', error);
    return res.status(500).json({ message: 'Internal server error generating CSV report' });
  }
}
