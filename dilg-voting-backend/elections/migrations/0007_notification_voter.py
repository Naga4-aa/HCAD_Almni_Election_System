from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("elections", "0006_nomination_status_rejection_reason"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="voter",
            field=models.ForeignKey(
                on_delete=models.deletion.CASCADE,
                related_name="notifications",
                null=True,
                blank=True,
                to="elections.voter",
            ),
        ),
    ]
