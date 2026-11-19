// profiles.js - Business profile engine. Adapts the whole app per profession.
// Each template: id, names (ar/en), vocabulary, enabled modules, default expense categories,
// default product categories, dashboard KPIs, POS mode, stock tracking, budget percentages, tips.
window.Kashf = window.Kashf || {};
Kashf.profiles = (function() {
  'use strict';

  const MODULES = {
    invoices: 'fواتير', quotes: 'عروض أسعار', clients: 'العملاء', expenses: 'المصاريف',
    products: 'المنتجات', inventory: 'المخزون', pos: 'نقطة البيع', employees: 'الموظفون',
    payroll: 'المرتبات', reports: 'التقارير', budget: 'الميزانية', analysis: 'المساعد',
    stocktake: 'الجرد', services: 'الخدمات', timeTracking: 'تتبع الوقت'
  };

  // Vocabulary keys map a generic term to the profile-specific word.
  function vocab(overrides) {
    const base = {
      products: 'المنتجات', product: 'منتج', inventory: 'المخزون', pos: 'نقطة البيع',
      services: 'الخدمات', service: 'خدمة', clients: 'العملاء', client: 'عميل',
      expenses: 'المصاريف', expense: 'مصروف', employees: 'الموظفون', employee: 'موظف',
      dashboard: 'لوحة التحكم', reports: 'التقارير', settings: 'الإعدادات',
      sales: 'المبيعات', purchases: 'المشتريات', payroll: 'المرتبات'
    };
    return { ...base, ...overrides };
  }

  const PROFILES = [
    {
      id: 'supermarket', name: { ar: 'سوبر ماركت', en: 'Supermarket' },
      group: 'retail', vocabulary: vocab({ products: 'المنتجات', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'scanner', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['molto','chips','drinks','dairy','canned','cleaning','bakery','other'],
      dashboardKPIs: ['cashOnHand','inventoryValue','lowStock','todaysSales','payrollDue'],
      defaultBudget: { fixed: 55, goods: 25, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'راقب الكراتين والق individuales، واضبط حد 낮은 للمخزون.', en: 'Track cartons and pieces; set a low-stock threshold.' }
    },
    {
      id: 'cafe', name: { ar: 'كافيه', en: 'Cafe' },
      group: 'retail', vocabulary: vocab({ products: 'المنيو', product: 'صنف', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'touch', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['coffee','tea','juice','sandwiches','desserts','bakery','other'],
      dashboardKPIs: ['cashOnHand','todaysSales','ordersCount','payrollDue','inventoryValue'],
      defaultBudget: { fixed: 50, goods: 30, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'استخدم وضع اللمس للأصناف 대규모، والماسح اختياري.', en: 'Use touch grid for items; scanner optional.' }
    },
    {
      id: 'restaurant', name: { ar: 'مطعم', en: 'Restaurant' },
      group: 'retail', vocabulary: vocab({ products: 'المنيو', product: 'وجبة', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'touch', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['mainDishes','appetizers','drinks','desserts','bakery','other'],
      dashboardKPIs: ['cashOnHand','todaysSales','ordersCount','payrollDue','foodCost'],
      defaultBudget: { fixed: 50, goods: 30, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'تتبع تكلفة الطعام والهدر يومياً.', en: 'Track food cost and waste daily.' }
    },
    {
      id: 'pharmacy', name: { ar: 'صيدلية', en: 'Pharmacy' },
      group: 'retail', vocabulary: vocab({ products: 'الأدوية', product: 'دواء', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'scanner', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['medicine','supplements','cosmetics','baby','other'],
      dashboardKPIs: ['cashOnHand','inventoryValue','expiryAlerts','lowStock','todaysSales'],
      defaultBudget: { fixed: 55, goods: 30, reserve: 10, marketing: 3, development: 2 },
      tips: { ar: 'انتبه لتواريخ انتهاء الصلاحية والجرعات.', en: 'Watch expiry dates and dosages.' }
    },
    {
      id: 'clothing', name: { ar: 'محل ملابس', en: 'Clothing Store' },
      group: 'retail', vocabulary: vocab({ products: 'المنتجات', product: 'قطعة', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'scanner', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['men','women','kids','shoes','accessories','other'],
      dashboardKPIs: ['cashOnHand','inventoryValue','todaysSales','lowStock','payrollDue'],
      defaultBudget: { fixed: 50, goods: 35, reserve: 10, marketing: 3, development: 2 },
      tips: { ar: 'رتب حسب المقاس واللون والموسم.', en: 'Organize by size, color and season.' }
    },
    {
      id: 'salon', name: { ar: 'صالون', en: 'Salon' },
      group: 'service', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', clients: 'العملاء' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','clientsCount','payrollDue','utilization'],
      defaultBudget: { fixed: 60, goods: 20, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'راجع إ productivity كل مصفف وموعد العمل.', en: 'Review stylist productivity and schedule.' }
    },
    {
      id: 'workshop', name: { ar: 'ورشة', en: 'Workshop' },
      group: 'service', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', products: 'قطع غيار', product: 'قطعة' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','products','inventory','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'none', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['spareParts','oil','tires','batteries','other'],
      dashboardKPIs: ['cashOnHand','todaysSales','openJobs','payrollDue','partsValue'],
      defaultBudget: { fixed: 55, goods: 25, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'تتبع قطع الغيار والعمالة لكل مركبة.', en: 'Track parts and labor per vehicle.' }
    },
    {
      id: 'clinic', name: { ar: 'عيادة', en: 'Clinic' },
      group: 'service', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', clients: 'المرضى', client: 'مريض' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','patientsCount','payrollDue','appointments'],
      defaultBudget: { fixed: 60, goods: 20, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'سجل مواعيد المرضى والمصروفات الطبية.', en: 'Log patient appointments and medical expenses.' }
    },
    {
      id: 'contracting', name: { ar: 'مقاولات', en: 'Contracting' },
      group: 'service', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', products: 'مواد بناء', product: 'مواد' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','products','inventory','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'none', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['cement','steel','tiles','paint','other'],
      dashboardKPIs: ['cashOnHand','activeProjects','todaysSales','payrollDue','materialsCost'],
      defaultBudget: { fixed: 50, goods: 30, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'راقب تكلفة المواد لكل مشروع.', en: 'Track material cost per project.' }
    },
    {
      id: 'training', name: { ar: 'سنتر تعليمي', en: 'Training Center' },
      group: 'service', vocabulary: vocab({ services: 'الدورات', service: 'دورة', clients: 'الطلاب', client: 'طالب' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','studentsCount','payrollDue','coursesCount'],
      defaultBudget: { fixed: 60, goods: 15, reserve: 10, marketing: 10, development: 5 },
      tips: { ar: 'تتبع حضور الطلاب وإيرادات الدورات.', en: 'Track student attendance and course revenue.' }
    },
    {
      id: 'gym', name: { ar: 'جيم', en: 'Gym' },
      group: 'service', vocabulary: vocab({ services: 'العضويات', service: 'عضوية', clients: 'الأعضاء', client: 'عضو' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','membersCount','payrollDue','activeMemberships'],
      defaultBudget: { fixed: 55, goods: 20, reserve: 10, marketing: 10, development: 5 },
      tips: { ar: 'تابع تجديد العضويات والحضور.', en: 'Track membership renewals and attendance.' }
    },
    {
      id: 'services', name: { ar: 'مكتب خدمات', en: 'Services Office' },
      group: 'service', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', clients: 'العملاء', client: 'عميل' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','clientsCount','payrollDue','openTasks'],
      defaultBudget: { fixed: 55, goods: 20, reserve: 10, marketing: 10, development: 5 },
      tips: { ar: 'رتب الفواتير حسب الخدمة والعميل.', en: 'Organize invoices by service and client.' }
    },
    {
      id: 'freelancer_designer', name: { ar: 'مصمم', en: 'Designer' },
      group: 'freelancer', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', clients: 'العملاء', client: 'عميل' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','timeTracking','reports','budget','analysis'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['internet','electricity','software','transport','marketing','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','activeProjects','hourlyRate','pendingInvoices'],
      defaultBudget: { fixed: 40, goods: 10, reserve: 25, marketing: 15, development: 10 },
      tips: { ar: 'لا توجد منتجات أو نقطة بيع؛ ركّز على الخدمات والفواتير.', en: 'No products or POS; focus on services and invoices.' }
    },
    {
      id: 'freelancer_programmer', name: { ar: 'مبرمج', en: 'Programmer' },
      group: 'freelancer', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', clients: 'العملاء', client: 'عميل' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','timeTracking','reports','budget','analysis'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['internet','electricity','software','transport','marketing','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','activeProjects','hourlyRate','pendingInvoices'],
      defaultBudget: { fixed: 40, goods: 10, reserve: 25, marketing: 15, development: 10 },
      tips: { ar: 'سجل الساعات القابلة للفوترة لكل مشروع.', en: 'Log billable hours per project.' }
    },
    {
      id: 'freelancer_writer', name: { ar: 'كاتب', en: 'Writer' },
      group: 'freelancer', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', clients: 'العملاء', client: 'عميل' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','timeTracking','reports','budget','analysis'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['internet','electricity','software','transport','marketing','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','activeProjects','pendingInvoices'],
      defaultBudget: { fixed: 40, goods: 10, reserve: 25, marketing: 15, development: 10 },
      tips: { ar: 'عروض الأسعار توضح نطاق العمل وما ليس شاملاً.', en: 'Quotes clarify scope and exclusions.' }
    },
    {
      id: 'freelancer_photographer', name: { ar: 'مصور', en: 'Photographer' },
      group: 'freelancer', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', clients: 'العملاء', client: 'عميل' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','timeTracking','reports','budget','analysis'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['internet','electricity','equipment','transport','marketing','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','bookingsCount','pendingInvoices'],
      defaultBudget: { fixed: 40, goods: 15, reserve: 20, marketing: 15, development: 10 },
      tips: { ar: 'تتبع المعدات和平جز لكل جلسة.', en: 'Track equipment and bookings per session.' }
    },
    {
      id: 'freelancer_translator', name: { ar: 'مترجم', en: 'Translator' },
      group: 'freelancer', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', clients: 'العملاء', client: 'عميل' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','timeTracking','reports','budget','analysis'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['internet','electricity','software','transport','marketing','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','wordsTranslated','pendingInvoices'],
      defaultBudget: { fixed: 40, goods: 10, reserve: 25, marketing: 15, development: 10 },
      tips: { ar: 'افرض بالمفردات أو بالساعة.', en: 'Charge per word or per hour.' }
    },
    {
      id: 'freelancer_trainer', name: { ar: 'مدرب', en: 'Trainer' },
      group: 'freelancer', vocabulary: vocab({ services: 'الخدمات', service: 'خدمة', clients: 'العملاء', client: 'عميل' }),
      enabledModules: ['invoices','quotes','clients','expenses','services','timeTracking','reports','budget','analysis'],
      posMode: 'none', stockTracking: false,
      defaultExpenseCategories: ['internet','electricity','venue','transport','marketing','taxes','emergency','other'],
      defaultProductCategories: [],
      dashboardKPIs: ['cashOnHand','todaysSales','sessionsCount','pendingInvoices'],
      defaultBudget: { fixed: 40, goods: 10, reserve: 25, marketing: 15, development: 10 },
      tips: { ar: 'تابع الحجوزات والحضور لكل جلسة.', en: 'Track bookings and attendance per session.' }
    },
    {
      id: 'bakery', name: { ar: 'مخبز', en: 'Bakery' },
      group: 'retail', vocabulary: vocab({ products: 'المخبوزات', product: 'صنف', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'touch', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['bread','pastries','cakes','cookies','other'],
      dashboardKPIs: ['cashOnHand','todaysSales','inventoryValue','payrollDue','lowStock'],
      defaultBudget: { fixed: 50, goods: 30, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'تابع إنتاج اليوم ومخزون الدقيق.', en: 'Track daily production and flour stock.' }
    },
    {
      id: 'electronics', name: { ar: 'محل إلكترونيات', en: 'Electronics Store' },
      group: 'retail', vocabulary: vocab({ products: 'الأجهزة', product: 'جهاز', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'scanner', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['phones','accessories','computers','appliances','other'],
      dashboardKPIs: ['cashOnHand','inventoryValue','todaysSales','lowStock','payrollDue'],
      defaultBudget: { fixed: 50, goods: 35, reserve: 10, marketing: 3, development: 2 },
      tips: { ar: 'سجّل الأرقام التسلسلية والضمان.', en: 'Record serial numbers and warranties.' }
    },
    {
      id: 'bookstore', name: { ar: 'مكتبة', en: 'Bookstore' },
      group: 'retail', vocabulary: vocab({ products: 'الكتب', product: 'كتاب', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'scanner', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['books','stationery','gifts','other'],
      dashboardKPIs: ['cashOnHand','inventoryValue','todaysSales','lowStock','payrollDue'],
      defaultBudget: { fixed: 55, goods: 25, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'راقب الكتب بطيئة الحركة.', en: 'Watch slow-moving titles.' }
    },
    {
      id: 'jewelry', name: { ar: 'محل مجوهرات', en: 'Jewelry Store' },
      group: 'retail', vocabulary: vocab({ products: 'القطع', product: 'قطعة', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'scanner', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['gold','silver','watches','accessories','other'],
      dashboardKPIs: ['cashOnHand','inventoryValue','todaysSales','payrollDue','highValueStock'],
      defaultBudget: { fixed: 50, goods: 35, reserve: 10, marketing: 3, development: 2 },
      tips: { ar: 'تتبع قيمة المخزون بدقة عالية.', en: 'Track inventory value carefully.' }
    },
    {
      id: 'florist', name: { ar: 'محل ورد', en: 'Florist' },
      group: 'retail', vocabulary: vocab({ products: 'المنتجات', product: 'باقة', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'touch', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['roses','bouquets','plants','gifts','other'],
      dashboardKPIs: ['cashOnHand','todaysSales','inventoryValue','payrollDue','wasteRate'],
      defaultBudget: { fixed: 50, goods: 30, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'راقب تلف الورود اليومي.', en: 'Monitor daily flower spoilage.' }
    },
    {
      id: 'butcher', name: { ar: 'جزارة', en: 'Butcher Shop' },
      group: 'retail', vocabulary: vocab({ products: 'اللحوم', product: 'صنف', inventory: 'المخزون', pos: 'نقطة البيع' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','pos','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'scanner', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['beef','lamb','poultry','processed','other'],
      dashboardKPIs: ['cashOnHand','todaysSales','inventoryValue','payrollDue','expiryAlerts'],
      defaultBudget: { fixed: 50, goods: 30, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'تابع صلاحية اللحوم والوزن بدقة.', en: 'Track meat freshness and weight accurately.' }
    },
    {
      id: 'other', name: { ar: 'أخرى', en: 'Other / Generic' },
      group: 'generic', vocabulary: vocab({ products: 'المنتجات', services: 'الخدمات', clients: 'العملاء' }),
      enabledModules: ['invoices','quotes','clients','expenses','products','inventory','services','employees','payroll','reports','budget','analysis','stocktake'],
      posMode: 'none', stockTracking: true,
      defaultExpenseCategories: ['rent','internet','electricity','water','salaries','goods','transport','marketing','maintenance','taxes','emergency','other'],
      defaultProductCategories: ['other'],
      dashboardKPIs: ['cashOnHand','todaysSales','payrollDue','inventoryValue'],
      defaultBudget: { fixed: 50, goods: 30, reserve: 10, marketing: 5, development: 5 },
      tips: { ar: 'قالب عام يناسب أي نشاط.', en: 'Generic template for any business.' }
    }
  ];

  const BY_ID = new Map(PROFILES.map(p => [p.id, p]));

  function get(id) { return BY_ID.get(id) || BY_ID.get('other'); }
  function all() { return PROFILES; }
  function ids() { return PROFILES.map(p => p.id); }

  // Module visibility per profile.
  function enabledModules(id) { return (get(id).enabledModules || []).slice(); }
  function isModuleEnabled(id, moduleKey) { return (get(id).enabledModules || []).includes(moduleKey); }

  // Whether POS/scanner should be shown.
  function posMode(id) { return get(id).posMode || 'none'; }
  function usesScanner(id) { return get(id).posMode === 'scanner'; }
  function usesTouch(id) { return get(id).posMode === 'touch'; }
  function stockTracking(id) { return !!get(id).stockTracking; }

  // Vocabulary lookup with fallback to default translation.
  function word(id, key, lang = 'ar') {
    const p = get(id);
    const v = (p.vocabulary && p.vocabulary[key]);
    if (v) return v;
    return Kashf.i18n ? Kashf.i18n.t(key) : key;
  }

  function dashboardKPIs(id) { return get(id).dashboardKPIs || []; }
  function defaultExpenseCategories(id) { return get(id).defaultExpenseCategories || []; }
  function defaultProductCategories(id) { return get(id).defaultProductCategories || []; }
  function defaultBudget(id) { return get(id).defaultBudget || {}; }
  function tips(id) { return get(id).tips || {}; }
  function name(id, lang = 'ar') { return (get(id).name || {})[lang] || get(id).id; }

  // Schema validation for AI-generated profiles.
  const SCHEMA = {
    required: ['id','name','vocabulary','enabledModules','posMode','stockTracking','dashboardKPIs','defaultBudget','tips'],
    moduleKeys: Object.keys(MODULES)
  };
  function validate(profile) {
    const errors = [];
    for (const k of SCHEMA.required) {
      if (!(k in profile)) errors.push('missing ' + k);
    }
    if (profile.enabledModules) {
      for (const m of profile.enabledModules) {
        if (!SCHEMA.moduleKeys.includes(m)) errors.push('unknown module ' + m);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  return {
    get, all, ids, enabledModules, isModuleEnabled, posMode, usesScanner, usesTouch,
    stockTracking, word, dashboardKPIs, defaultExpenseCategories, defaultProductCategories,
    defaultBudget, tips, name, validate, MODULES
  };
})();
