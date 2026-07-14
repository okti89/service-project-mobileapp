[]servis değişimleri bildirim mesajlarını değiştir
[] servis bildirimlerinde related ile sayfaya gittiğini doğrula
[] bildirimlerin belirli aralıklarla silindiğini doğrula
[] servis pdf inin whatsapp ile direk dosya şeklinde gittiğini doğrula
[]firma kodunun görünmesini unutma bunu admin görecek
[] errorboundary sayfası düzeltilecek
[] hesap onaylanmadı ve pasife alındı sayfaları ypaılacak
[] teknisyen ve user listesi gerektiren durumlarda aktif olmayan kullanıcılar olmadığından emin ol mesela servis atama listesi vs.
[] servislerde durum değiştiğinde müşteriye whatsapp mesajı gönderilsin mi diye sormalı

send_daily_service_summaries: Her gün 08:00.
send_shift_start_reminders: */15 8-18 * * *.
send_pending_approval_reminders: Her gün 09:00 önerilir.
cleanup_old_notifications --days 90: Her gece 03:30 önerilir
*/15 17-23 * * *   python manage.py send_shift_end_reminders --grace-minutes 15
*/30 7-20 * * *    python manage.py send_operational_alerts
python manage.py cleanup_old_notifications --days 90