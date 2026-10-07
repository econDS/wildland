<p align="center"><img src="icons/icon-192.png" width="96" height="96" alt="WILDLAND icon"></p>

<h1 align="center">WILDLAND — 30 วันในป่าลึก</h1>

<p align="center">เกมเอาตัวรอดเชิงวางแผนภาษาไทย เล่นบนเว็บ ติดตั้งเป็นแอป หรือเล่นบน Android ได้ ทำงานออฟไลน์ทั้งหมด<br>
<sub>A Thai-language, turn-based wilderness survival game for the web (PWA) and Android. Fully offline.</sub></p>

<p align="center">
  <a href="https://econds.github.io/wildland/"><b>▶ เล่นบนเว็บ</b></a> ·
  <a href="https://github.com/econDS/wildland/releases/latest"><b>ดาวน์โหลด APK</b></a> ·
  <a href="docs/PLAYER_GUIDE.md">คู่มือผู้เล่น</a>
</p>

## เกี่ยวกับเกม

คุณหลงอยู่ในป่าลึก มีทางรอดสองทาง: **อยู่ให้ครบ 30 วัน** หรือ **รวบรวมชิ้นส่วนวิทยุ** แล้วขึ้นไปส่งสัญญาณขอความช่วยเหลือที่สันเขา

- เวลาเดินเฉพาะตอนที่คุณลงมือทำ ค่อยๆ คิดได้ทุกตา
- ดูแลค่าร่างกาย 5 ค่า: สุขภาพ พลังงาน ความอิ่ม น้ำ และความอบอุ่น
- สร้างเพิงพัก ก่อไฟ ต้มน้ำ ล่าสัตว์ ตกปลา และทำเครื่องมือ
- พื้นที่ 7 แห่งที่เชื่อมกันเป็นแผนที่ มีน้ำหลาก ต้นไม้ล้ม พายุ และจุดสำรวจพิเศษ
- ความยาก 3 ระดับ: นักสำรวจ · ผู้รอดชีวิต · ป่าไร้ปรานี
- ภาพและเสียงสร้างขึ้นสดด้วย Canvas และ Web Audio ไม่ต้องโหลดไฟล์ภาพหรือเสียง
- ไม่มีโฆษณา ไม่มีการติดตามผู้ใช้ และไม่ส่งข้อมูลออกจากเครื่อง

## วิธีเล่น

| แพลตฟอร์ม | วิธีติดตั้ง |
|---|---|
| เว็บ / iOS / เดสก์ท็อป | เปิด [econds.github.io/wildland](https://econds.github.io/wildland/) แล้วเลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอโฮม" เพื่อเล่นออฟไลน์ |
| Android | ดาวน์โหลดไฟล์ `.apk` จาก [Releases](https://github.com/econDS/wildland/releases/latest) แล้วอนุญาตการติดตั้งจากแหล่งที่ไม่รู้จัก |

เซฟเกมเก็บในเครื่องอัตโนมัติ ใช้เมนู ตั้งค่า → ส่งออก/นำเข้า เพื่อย้ายเซฟระหว่างเว็บกับแอป หรือสำรองไว้ก่อนถอนการติดตั้ง

## สำหรับนักพัฒนา

เกมเขียนด้วย HTML, CSS และ JavaScript ล้วน ไม่มีเฟรมเวิร์กหรือ bundler

```bash
npm start          # dev server ที่ http://127.0.0.1:8943
npm test           # unit tests (Node.js 22+)
npm run build:web  # สร้าง www/ สำหรับ GitHub Pages และ Capacitor
```

GitHub Actions จะ deploy เว็บขึ้น GitHub Pages และ build APK ให้อัตโนมัติ ไม่ต้องติดตั้ง Android Studio ในเครื่อง ดูรายละเอียดที่ [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

```
index.html, src/, styles/   ตัวเกม
icons/, manifest.webmanifest, sw.js   PWA
android/, capacitor.config.json      แอป Android (Capacitor)
scripts/                    build web และ icons
tests/                      tests
```

## License

[MIT](LICENSE)
