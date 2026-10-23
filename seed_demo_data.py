"""Fictional Damascus fixtures. Prices are illustrative SYP amounts, not quotations."""

SPECIALIZATIONS = (
    ("كهربائي", "Electrician"), ("سباك", "Plumber"),
    ("نجار", "Carpenter"), ("فني تكييف", "AC Technician"),
)

# Approximate neighbourhood pins; building numbers and addresses are fictional.
LOCATIONS = (
    ("المزة", 33.5008, 36.2526), ("المالكي", 33.5214, 36.2750),
    ("أبو رمانة", 33.5200, 36.2830), ("الشعلان", 33.5168, 36.2910),
    ("الميدان", 33.4910, 36.3020), ("كفرسوسة", 33.4918, 36.2734),
)

# Email local part, Arabic name, English name, neighbourhood index.
CUSTOMERS = (
    ("customer.demo", "رامي الخطيب", "Rami Al Khatib", 0),
    ("customer.sara", "سارة منصور", "Sara Mansour", 1),
    ("customer.omar", "عمر الحسن", "Omar Al Hassan", 2),
    ("customer.nour", "نور حداد", "Nour Haddad", 3),
    ("customer.yara", "يارا درويش", "Yara Darwish", 4),
    ("customer.karim", "كريم ناصر", "Karim Nasser", 5),
)

# Two technicians per specialization: local part, names, location, trade, bio.
TECHNICIANS = (
    ("tech.ahmad", "أحمد حمود", "Ahmad Hammoud", 0, 0,
     "صيانة التمديدات المنزلية ولوحات القواطع، خبرة 9 سنوات. / Home wiring and breaker panels; 9 years of experience."),
    ("tech.lina", "لينا عباس", "Lina Abbas", 1, 0,
     "تركيب الإنارة وتشخيص أعطال الكهرباء، خبرة 6 سنوات. / Lighting installation and electrical fault diagnosis; 6 years of experience."),
    ("tech.samer", "سامر يوسف", "Samer Youssef", 2, 1,
     "إصلاح التسربات وصيانة شبكات المياه، خبرة 11 سنة. / Leak repairs and water systems; 11 years of experience."),
    ("tech.hala", "هالة مصطفى", "Hala Mustafa", 3, 1,
     "صيانة المطابخ والحمامات وتركيب الخلاطات، خبرة 5 سنوات. / Kitchen and bathroom plumbing; 5 years of experience."),
    ("tech.fadi", "فادي سليمان", "Fadi Suleiman", 4, 2,
     "إصلاح الأبواب والخزائن والأثاث الخشبي، خبرة 12 سنة. / Doors, cabinets and wooden furniture; 12 years of experience."),
    ("tech.roula", "رولا صالح", "Roula Saleh", 5, 2,
     "تركيب الرفوف وضبط مفصلات الأثاث، خبرة 7 سنوات. / Shelving installation and furniture repairs; 7 years of experience."),
    ("tech.mazen", "مازن إبراهيم", "Mazen Ibrahim", 0, 3,
     "صيانة المكيفات وتنظيف الفلاتر وفحص التبريد، خبرة 8 سنوات. / AC servicing, filters and cooling diagnostics; 8 years of experience."),
    ("tech.dima", "ديمة مراد", "Dima Murad", 3, 3,
     "تنظيف وحدات التكييف ومعالجة تسرب المياه، خبرة 6 سنوات. / AC cleaning and condensate leak repairs; 6 years of experience."),
)

# Five different jobs per trade: description, illustrative subtotal in SYP.
JOBS = (
    (
        ("يفصل قاطع غرفة المعيشة عند تشغيل المدفأة؛ أحتاج فحص الحمل والتوصيلات. / Living-room breaker trips when the heater runs; inspect the circuit and load.", 95000),
        ("أرغب بتركيب ثلاث وحدات إنارة في الممر وفحص المفاتيح الموجودة. / Install three hallway lights and check the existing switches.", 70000),
        ("مقبس المطبخ متوقف عن العمل؛ يرجى فحصه واستبدال القطعة التالفة. / Diagnose a kitchen socket that has stopped working and replace the faulty part.", 55000),
        ("أحتاج ترتيب لوحة القواطع ووضع تسميات واضحة لدوائر الشقة. / Tidy the breaker panel and label the apartment circuits.", 120000),
        ("مصباح الشرفة يومض بعد تبديل اللمبة؛ أحتاج فحص التوصيلات والمفتاح. / Balcony light flickers; check the wiring and switch.", 60000),
    ),
    (
        ("يوجد تسرب بطيء أسفل حوض المطبخ؛ يرجى فحص السيفون والوصلات. / Repair a slow leak beneath the kitchen sink and inspect the trap connections.", 65000),
        ("ضغط المياه ضعيف في خلاط الحمام فقط؛ أحتاج تنظيف الفلتر وفحص الخلاط. / Bathroom tap has low pressure; clean the filter and inspect the mixer.", 50000),
        ("صندوق الطرد لا يتوقف عن تعبئة المياه؛ يرجى إصلاح العوامة والصمام. / Toilet cistern keeps filling; repair the float and inlet valve.", 75000),
        ("أرغب بتركيب خلاط مطبخ جديد وفحص عدم وجود تسرب بعد التركيب. / Fit a new kitchen mixer tap and test for leaks.", 85000),
        ("تصريف مغسلة الحمام بطيء؛ أحتاج تنظيف السيفون وفحص أنبوب التصريف. / Clear a slow-draining bathroom basin and check the waste pipe.", 60000),
    ),
    (
        ("باب غرفة النوم يحتك بالأرض ولا يغلق بسهولة؛ أحتاج ضبط المفصلات. / Bedroom door rubs against the floor; adjust the hinges and alignment.", 80000),
        ("أرغب بتركيب رفّين خشبيين في غرفة الدراسة مع تثبيت مناسب للجدار. / Install two wooden study shelves with suitable wall fixings.", 110000),
        ("مفصلات خزانة المطبخ مرتخية؛ يرجى تبديل المفصلات وضبط الأبواب. / Replace loose kitchen cabinet hinges and align the doors.", 90000),
        ("درجان في خزانة الملابس لا يتحركان بسلاسة؛ أحتاج تبديل السكك. / Replace the runners on two sticking wardrobe drawers.", 105000),
        ("طاولة الطعام غير ثابتة؛ يرجى فحص الوصلات وتثبيت الأرجل. / Repair loose joints and secure the legs of a wobbly dining table.", 75000),
    ),
    (
        ("تبريد مكيف غرفة الجلوس ضعيف؛ أحتاج تنظيف الفلاتر وفحص الأداء. / Living-room AC cools poorly; clean the filters and check performance.", 125000),
        ("تتسرب المياه من الوحدة الداخلية للمكيف؛ يرجى تنظيف مجرى التصريف. / Clear the condensate drain on an indoor AC unit that is leaking water.", 95000),
        ("أرغب بصيانة دورية لمكيف غرفة النوم قبل استخدام وضع التدفئة. / Service the bedroom AC before switching to heating mode.", 115000),
        ("المكيف يصدر صوت اهتزاز أثناء التشغيل؛ أحتاج فحص التثبيت والمروحة. / Inspect the mounting and fan of an AC unit that vibrates during operation.", 140000),
        ("تدفق الهواء من المكيف ضعيف رغم تنظيف الفلتر؛ يرجى فحص المروحة. / Check the AC fan; airflow remains weak after filter cleaning.", 130000),
    ),
)

REVIEWS = (
    (5, "التزم بالموعد وشرح المشكلة بوضوح، والنتيجة ممتازة. / On time, explained the fault clearly, and did excellent work."),
    (4, "تم الإصلاح بشكل جيد وترك المكان نظيفاً. / Good repair and a tidy workspace afterwards."),
    (5, "عمل متقن وسعر مطابق للعرض المتفق عليه. / Careful work at the agreed price."),
    (4, "خدمة جيدة، تأخر قليلاً لكنه اتصل لإبلاغي. / Good service; arrived a little late but called ahead."),
    (3, "تم حل المشكلة، لكن الزيارة استغرقت أطول من المتوقع. / The issue was fixed, though the visit took longer than expected."),
)

DEMO_PASSWORD = "Demo1234"
DEMO_EMAILS = (
    "admin.demo@upkeep.local",
    *(f"{row[0]}@upkeep.local" for row in CUSTOMERS),
    *(f"{row[0]}@upkeep.local" for row in TECHNICIANS),
)
